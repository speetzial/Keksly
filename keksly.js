(function () {
    'use strict';


    const defaultConfig = {
        services: [
            {
                id: 'essential',
                name: 'Essential',
                description: 'Necessary for the website to function.',
                required: true,
                enabled: true,
                category: ['security_storage'],
            }
        ],
        texts: {
            banner: {
                title: 'We value your privacy',
                description: 'We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.',
                acceptAll: 'Accept All',
                rejectAll: 'Reject All',
                settings: 'Customize',
            },
            settings: {
                title: 'Cookie Preferences',
                save: 'Save Preferences',
                back: 'Back',
            },
            links: {
                privacyPolicy: { text: 'Privacy Policy', url: '#' },
                imprint: { text: 'Imprint', url: '#' },
            },
        },
        design: {
            primaryColor: '#3b82f6',
            backgroundColor: '#ffffff',
            textColor: '#1f2937',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'bottom',
            buttons: [
                { type: 'accept', label: 'Accept All', variant: 'primary' },
                { type: 'reject', label: 'Reject All', variant: 'secondary' },
                { type: 'settings', label: 'Customize', variant: 'secondary' }
            ]
        },
        gcm: {
            enabled: true,
        },
    };

    let config = { ...defaultConfig };
    let consentState = {};


    function deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], deepMerge(target[key], source[key]));
            }
        }
        Object.assign(target || {}, source);
        return target;
    }


    function init() {
        if (window.KekslyConfig) {
            config = deepMerge(config, window.KekslyConfig);
            run();
        } else {
            const scriptTag = document.currentScript || document.querySelector('script[src*="keksly.js"]');
            const configUrl = scriptTag ? scriptTag.getAttribute('data-config') : null;

            if (configUrl) {
                fetch(configUrl)
                    .then(response => response.json())
                    .then(data => {
                        config = deepMerge(config, data);
                        run();
                    })
                    .catch(err => {
                        console.error('Keksly: Failed to load config', err);
                        run();
                    });
            } else {
                run();
            }
        }
    }

    function run() {
        loadConsent();
        injectStyles();

        if (!localStorage.getItem('keksly_consent')) {
            showBanner();
        } else {
            applyConsent();
        }


        window.Keksly = {
            openSettings: showSettingsModal,
            reset: () => {
                localStorage.removeItem('keksly_consent');
                location.reload();
            }
        };
    }

    function loadConsent() {
        const storedConsent = localStorage.getItem('keksly_consent');
        if (storedConsent) {
            try {
                consentState = JSON.parse(storedConsent);
            } catch (e) {
                consentState = {};
            }
        } else {
            config.services.forEach(srv => {
                consentState[srv.id] = srv.required;
            });
        }
        config.services.forEach(srv => {
            if (srv.required) consentState[srv.id] = true;
        });
    }

    function saveConsent(newState) {
        consentState = { ...consentState, ...newState };
        config.services.forEach(srv => {
            if (srv.required) consentState[srv.id] = true;
        });
        localStorage.setItem('keksly_consent', JSON.stringify(consentState));
        applyConsent();
        hideBanner();
        hideSettingsModal();
    }

    function applyConsent() {
        pushDataLayer();
        if (config.gcm.enabled) updateGcm();
        handleScriptBlocking();
    }

    function pushDataLayer() {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: 'keksly_consent_update',
            consent: consentState
        });
    }

    function updateGcm() {
        const hasConsent = (gcmType) => {
            return config.services.some(srv =>
                Array.isArray(srv.category) &&
                srv.category.includes(gcmType) &&
                consentState[srv.id]
            );
        };

        const gcmStatus = {
            ad_storage: hasConsent('ad_storage') ? 'granted' : 'denied',
            analytics_storage: hasConsent('analytics_storage') ? 'granted' : 'denied',
            ad_user_data: hasConsent('ad_user_data') ? 'granted' : 'denied',
            ad_personalization: hasConsent('ad_personalization') ? 'granted' : 'denied',
        };

        function gtag() {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push(arguments);
        }

        gtag('consent', 'update', gcmStatus);
    }

    function handleScriptBlocking() {
        const scripts = document.querySelectorAll('script[type="text/plain"][data-service]');
        scripts.forEach(script => {
            const serviceId = script.getAttribute('data-service');
            if (consentState[serviceId]) {
                const newScript = document.createElement('script');
                newScript.type = 'text/javascript';
                if (script.src) {
                    newScript.src = script.src;
                } else {
                    newScript.innerHTML = script.innerHTML;
                }
                Array.from(script.attributes).forEach(attr => {
                    if (attr.name !== 'type' && attr.name !== 'data-service') {
                        newScript.setAttribute(attr.name, attr.value);
                    }
                });
                script.parentNode.replaceChild(newScript, script);
            }
        });
    }

    function injectStyles() {
        if (document.getElementById('keksly-styles')) return;
        const { design } = config;
        const css = `
            #keksly-banner {
                position: fixed;
                ${design.position === 'bottom' ? 'bottom: 20px; left: 20px; right: 20px;' : 'top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 500px;'}
                background-color: ${design.backgroundColor};
                color: ${design.textColor};
                font-family: ${design.fontFamily};
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
                gap: 16px;
                opacity: 0;
                transition: opacity 0.3s ease;
                max-width: ${design.position === 'bottom' ? '100%' : '500px'};
            }
            @media (min-width: 768px) {
                #keksly-banner {
                    ${design.position === 'bottom' ? 'max-width: 400px; left: auto; right: 20px;' : ''}
                }
            }
            #keksly-banner.visible { opacity: 1; }
            
            .keksly-title { margin: 0; font-size: 18px; font-weight: 700; }
            .keksly-desc { margin: 0; font-size: 14px; line-height: 1.5; opacity: 0.9; }
            
            .keksly-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
            
            .keksly-btn {
                padding: 10px 20px;
                border-radius: 6px;
                border: none;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: transform 0.1s, opacity 0.2s;
                flex: 1;
                white-space: nowrap;
                text-align: center;
            }
            .keksly-btn:active { transform: scale(0.98); }
            
            .keksly-btn-primary { background-color: ${design.primaryColor}; color: #fff; }
            .keksly-btn-secondary { background-color: transparent; border: 1px solid ${design.textColor}; color: ${design.textColor}; }
            .keksly-btn-text { background: none; color: ${design.textColor}; text-decoration: underline; font-size: 12px; padding: 0; margin-top: 10px; width: 100%; text-align: center; cursor: pointer; border: none;}

            #keksly-modal {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.6);
                z-index: 2147483648;
                display: none;
                align-items: center;
                justify-content: center;
                font-family: ${design.fontFamily};
                backdrop-filter: blur(2px);
            }
            #keksly-modal.open { display: flex; }
            
            .keksly-modal-content {
                background: ${design.backgroundColor};
                color: ${design.textColor};
                width: 90%; max-width: 600px; max-height: 90vh;
                border-radius: 12px;
                display: flex; flex-direction: column;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            }
            
            .keksly-modal-header { padding: 20px; border-bottom: 1px solid rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
            .keksly-modal-header h3 { margin: 0; font-size: 20px; }
            .keksly-close { background: none; border: none; font-size: 24px; cursor: pointer; color: ${design.textColor}; }
            
            .keksly-modal-body { padding: 20px; overflow-y: auto; }
            
            .keksly-category { margin-bottom: 20px; }
            .keksly-cat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
            .keksly-cat-title { font-weight: 600; font-size: 16px; }
            .keksly-cat-desc { font-size: 14px; opacity: 0.8; }
            
            .keksly-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
            .keksly-switch input { opacity: 0; width: 0; height: 0; }
            .keksly-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; }
            .keksly-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
            input:checked + .keksly-slider { background-color: ${design.primaryColor}; }
            input:checked + .keksly-slider:before { transform: translateX(20px); }
            input:disabled + .keksly-slider { opacity: 0.5; cursor: not-allowed; }
            
            .keksly-modal-footer { padding: 20px; border-top: 1px solid rgba(0,0,0,0.1); display: flex; justify-content: flex-end; gap: 10px; }
            
            .keksly-footer-links { display: flex; justify-content: center; gap: 15px; margin-top: 5px; }
            .keksly-footer-links a { color: ${design.textColor}; font-size: 12px; text-decoration: none; opacity: 0.7; }
            .keksly-footer-links a:hover { opacity: 1; text-decoration: underline; }

            #keksly-backdrop {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(2px);
                z-index: 2147483646;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            #keksly-backdrop.visible { opacity: 1; }
        `;
        const style = document.createElement('style');
        style.id = 'keksly-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function showBanner() {
        if (document.getElementById('keksly-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'keksly-banner';
        const buttonsHtml = config.design.buttons.map(btn => {
            let className = 'keksly-btn';
            if (btn.variant === 'primary') className += ' keksly-btn-primary';
            else if (btn.variant === 'secondary') className += ' keksly-btn-secondary';
            else if (btn.variant === 'text') className += ' keksly-btn-text';

            return `<button data-action="${btn.type}" class="${className}">${btn.label}</button>`;
        }).join('');

        banner.innerHTML = `
            <h2 class="keksly-title">${config.texts.banner.title}</h2>
            <p class="keksly-desc">${config.texts.banner.description}</p>
            <div class="keksly-actions">
                ${buttonsHtml}
            </div>
            <div class="keksly-footer-links">
                <a href="${config.texts.links.privacyPolicy.url}" target="_blank">${config.texts.links.privacyPolicy.text}</a>
                <a href="${config.texts.links.imprint.url}" target="_blank">${config.texts.links.imprint.text}</a>
            </div>
        `;

        if (config.design.position === 'center') {
            const backdrop = document.createElement('div');
            backdrop.id = 'keksly-backdrop';
            document.body.appendChild(backdrop);
            backdrop.offsetHeight;
            backdrop.classList.add('visible');
        }

        document.body.appendChild(banner);

        banner.offsetHeight;
        banner.classList.add('visible');


        const acceptBtn = banner.querySelector('[data-action="accept"]');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => {
                const all = {};
                config.services.forEach(s => all[s.id] = true);
                saveConsent(all);
            });
        }

        const rejectBtn = banner.querySelector('[data-action="reject"]');
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => {
                const req = {};
                config.services.forEach(s => req[s.id] = s.required);
                saveConsent(req);
            });
        }

        const settingsBtn = banner.querySelector('[data-action="settings"]');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', showSettingsModal);
        }
    }

    function hideBanner() {
        const banner = document.getElementById('keksly-banner');
        if (banner) banner.remove();

        const backdrop = document.getElementById('keksly-backdrop');
        if (backdrop) backdrop.remove();
    }

    function showSettingsModal() {
        let modal = document.getElementById('keksly-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'keksly-modal';
            document.body.appendChild(modal);
        }

        const servicesHtml = config.services.map(service => `
            <div class="keksly-category">
                <div class="keksly-cat-header">
                    <span class="keksly-cat-title">${service.name}</span>
                    <label class="keksly-switch">
                        <input type="checkbox" data-id="${service.id}" ${service.required ? 'checked disabled' : ''} ${consentState[service.id] ? 'checked' : ''}>
                        <span class="keksly-slider"></span>
                    </label>
                </div>
                <div class="keksly-cat-desc">${service.description}</div>
            </div>
        `).join('');

        modal.innerHTML = `
            <div class="keksly-modal-content">
                <div class="keksly-modal-header">
                    <h3>${config.texts.settings.title}</h3>
                    <button class="keksly-close">&times;</button>
                </div>
                <div class="keksly-modal-body">
                    ${servicesHtml}
                </div>
                <div class="keksly-modal-footer">
                    <button class="keksly-btn keksly-btn-secondary keksly-close-btn">${config.texts.settings.back}</button>
                    <button id="keksly-save" class="keksly-btn keksly-btn-primary">${config.texts.settings.save}</button>
                </div>
            </div>
        `;

        modal.classList.add('open');

        const close = () => modal.classList.remove('open');
        modal.querySelector('.keksly-close').addEventListener('click', close);
        modal.querySelector('.keksly-close-btn').addEventListener('click', close);

        document.getElementById('keksly-save').addEventListener('click', () => {
            const newState = {};
            modal.querySelectorAll('input[type="checkbox"]').forEach(input => {
                newState[input.getAttribute('data-id')] = input.checked;
            });
            saveConsent(newState);
        });
    }

    function hideSettingsModal() {
        const modal = document.getElementById('keksly-modal');
        if (modal) modal.classList.remove('open');
    }


    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

// For Madita <3