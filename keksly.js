(function () {
    'use strict';



    const defaultConfig = {
        version: 1,
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
                historyLink: 'View your consent history',
                historyTitle: 'Consent History',
                historyEmpty: 'No history entries yet.'
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
            buttons: []
        },
        gcm: {
            enabled: true,
        },
        uid: {
            version: 1,
            respectDnt: true,
        },
    };

    let config = { ...defaultConfig };
    let consentState = {};
    let consentHistory = [];
    let lastHistoryEntry = null;
    let shouldShowBanner = false;
    let userId = null;



    function deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], deepMerge(target[key], source[key]));
            }
        }
        Object.assign(target || {}, source);
        return target;
    }

    function generateUuid() {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
        const tpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
        return tpl.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function generateUid() {
        let stored = null;
        try {
            stored = localStorage.getItem('keksly_uid');
        } catch (_) { stored = null; }
        
        if (stored) {
            userId = stored;
            return Promise.resolve(userId);
        }

        userId = generateUuid();
        try {
            localStorage.setItem('keksly_uid', userId);
        } catch (_) { }
        return Promise.resolve(userId);
    }


    function init() {
        const start = () => generateUid().finally(() => run());

        if (window.KekslyConfig) {
            config = deepMerge(config, window.KekslyConfig);
            start();
        } else {
            const scriptTag = document.currentScript || document.querySelector('script[src*="keksly.js"]');
            const configUrl = scriptTag ? scriptTag.getAttribute('data-config') : null;

            if (configUrl) {
                fetch(configUrl)
                    .then(response => response.json())
                    .then(data => {
                        config = deepMerge(config, data);
                        start();
                    })
                    .catch(err => {
                        console.error('Keksly: Failed to load config', err);
                        start();
                    });
            } else {
                start();
            }
        }
    }

    function run() {
        loadConsent();
        loadHistory();
        injectStyles();

        if (shouldShowBanner || !localStorage.getItem('keksly_consent')) {
            showBanner();
        } else {
            applyConsent();
        }


        window.Keksly = {
            openSettings: showSettingsModal,
            reset: () => {
                localStorage.removeItem('keksly_consent');
                localStorage.removeItem('keksly_version');
                localStorage.removeItem('keksly_consent_history');
                localStorage.removeItem('keksly_uid');
                location.reload();
            },
            getUid: () => userId
        };
    }

    function loadConsent() {
        const configVersion = Number(config.version || 1);
        const storedVersion = Number(localStorage.getItem('keksly_version'));
        const storedConsent = localStorage.getItem('keksly_consent');
        shouldShowBanner = false;

        const initializeConsent = () => {
            consentState = {};
            config.services.forEach(srv => {
                consentState[srv.id] = !!srv.required;
            });
        };

        if (storedConsent) {
            try {
                consentState = JSON.parse(storedConsent);
            } catch (e) {
                consentState = {};
            }
        } else {
            initializeConsent();
        }

        if (storedVersion !== configVersion) {
            initializeConsent();
            localStorage.removeItem('keksly_consent');
            shouldShowBanner = true;
            try {
                localStorage.setItem('keksly_version', String(configVersion));
            } catch (e) {
                console.warn('Keksly: failed to persist version', e);
            }
        }

        config.services.forEach(srv => {
            if (srv.required) consentState[srv.id] = true;
        });

        if (!storedConsent) {
            shouldShowBanner = true;
        }
    }

    function loadHistory() {
        const stored = localStorage.getItem('keksly_consent_history');
        if (stored) {
            try {
                consentHistory = JSON.parse(stored) || [];
            } catch (e) {
                consentHistory = [];
            }
        }
        lastHistoryEntry = consentHistory.length ? consentHistory[consentHistory.length - 1] : null;
    }

    function appendHistory(meta) {
        const entry = {
            timestamp: new Date().toISOString(),
            uid: userId,
            consent: consentState,
            source: meta.source || 'unknown',
            action: meta.action || 'update'
        };
        consentHistory.push(entry);
        lastHistoryEntry = entry;
        try {
            localStorage.setItem('keksly_consent_history', JSON.stringify(consentHistory));
        } catch (e) {
            console.warn('Keksly: failed to persist consent history', e);
        }
    }

    function renderHistoryList(container) {
        if (!container) return;
        if (!consentHistory.length) {
            container.innerHTML = `<div class="keksly-history-item">${config.texts.settings.historyEmpty}</div>`;
            return;
        }
        const items = [...consentHistory].reverse().map(entry => `<div class="keksly-history-item"><div><strong>${entry.action}</strong></div><span class="keksly-history-meta">${entry.timestamp} · ${entry.source} · UID: ${entry.uid || '-'}</span><div class="keksly-history-meta">${JSON.stringify(entry.consent)}</div></div>`).join('');
        container.innerHTML = `<div class="keksly-history-item"><strong>${config.texts.settings.historyTitle}</strong></div>` + items;
    }

    function saveConsent(newState, meta = {}) {
        consentState = { ...consentState, ...newState };
        config.services.forEach(srv => {
            if (srv.required) consentState[srv.id] = true;
        });
        const configVersion = Number(config.version || 1);
        try {
            localStorage.setItem('keksly_consent', JSON.stringify(consentState));
            localStorage.setItem('keksly_version', String(configVersion));
        } catch (e) {
            console.warn('Keksly: failed to persist consent/version', e);
        }
        appendHistory(meta);
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
            consent: consentState,
            consent_history_entry: consentHistory,
            uid: userId
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
        const css = `#keksly-banner{position:fixed;${design.position==='bottom'?'bottom:20px;left:20px;right:20px;':'top:50%;left:50%;transform:translate(-50%,-50%);width:90%;max-width:500px;'}background-color:${design.backgroundColor};color:${design.textColor};font-family:${design.fontFamily};padding:24px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:2147483647;display:flex;flex-direction:column;gap:16px;opacity:0;transition:opacity 0.3s ease;max-width:${design.position==='bottom'?'100%':'500px'};}@media (min-width:768px){#keksly-banner{${design.position==='bottom'?'max-width:400px;left:auto;right:20px;':''}}}#keksly-banner.visible{opacity:1}.keksly-title{margin:0;font-size:18px;font-weight:700}.keksly-desc{margin:0;font-size:14px;line-height:1.5;opacity:0.9}.keksly-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}.keksly-btn{padding:10px 20px;border-radius:6px;border:none;cursor:pointer;font-size:14px;font-weight:600;transition:transform 0.1s,opacity 0.2s;flex:1;white-space:nowrap;text-align:center}.keksly-btn:active{transform:scale(0.98)}.keksly-btn-primary{background-color:${design.primaryColor};color:#fff}.keksly-btn-secondary{background-color:transparent;border:1px solid ${design.textColor};color:${design.textColor}}.keksly-btn-text{background:none;color:${design.textColor};text-decoration:underline;font-size:12px;padding:0;margin-top:10px;width:100%;text-align:center;cursor:pointer;border:none}#keksly-modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:2147483648;display:none;align-items:center;justify-content:center;font-family:${design.fontFamily};backdrop-filter:blur(2px)}#keksly-modal.open{display:flex}.keksly-modal-content{background:${design.backgroundColor};color:${design.textColor};width:90%;max-width:600px;max-height:90vh;border-radius:12px;display:flex;flex-direction:column;box-shadow:0 10px 25px rgba(0,0,0,0.2)}.keksly-modal-header{padding:20px;border-bottom:1px solid rgba(0,0,0,0.1);display:flex;justify-content:space-between;align-items:center}.keksly-modal-header h3{margin:0;font-size:20px}.keksly-close{background:none;border:none;font-size:24px;cursor:pointer;color:${design.textColor}}.keksly-modal-body{padding:20px;overflow-y:auto}.keksly-history-link{margin:10px 0 6px;text-align:right}.keksly-history-panel{border:1px solid rgba(0,0,0,0.1);border-radius:8px;padding:10px 12px;max-height:200px;overflow-y:auto;background:${design.position==='center'?'rgba(0,0,0,0.02)':'rgba(0,0,0,0.03)'}}.keksly-history-item{font-size:12px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.05)}.keksly-history-item:last-child{border-bottom:none}.keksly-history-meta{opacity:0.75;display:block}.keksly-category{margin-bottom:20px}.keksly-cat-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.keksly-cat-title{font-weight:600;font-size:16px}.keksly-cat-desc{font-size:14px;opacity:0.8}.keksly-switch{position:relative;display:inline-block;width:44px;height:24px}.keksly-switch input{opacity:0;width:0;height:0}.keksly-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#ccc;transition:.4s;border-radius:24px}.keksly-slider:before{position:absolute;content:"";height:18px;width:18px;left:3px;bottom:3px;background-color:white;transition:.4s;border-radius:50%}input:checked + .keksly-slider{background-color:${design.primaryColor}}input:checked + .keksly-slider:before{transform:translateX(20px)}input:disabled + .keksly-slider{opacity:0.5;cursor:not-allowed}.keksly-modal-footer{padding:20px;border-top:1px solid rgba(0,0,0,0.1);display:flex;justify-content:flex-end;gap:10px}.keksly-footer-links{display:flex;justify-content:center;gap:15px;margin-top:5px}.keksly-footer-links a{color:${design.textColor};font-size:12px;text-decoration:none;opacity:0.7}.keksly-footer-links a:hover{opacity:1;text-decoration:underline}#keksly-backdrop{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(2px);z-index:2147483646;opacity:0;transition:opacity 0.3s ease}#keksly-backdrop.visible{opacity:1}`;
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

        banner.innerHTML = `<h2 class="keksly-title">${config.texts.banner.title}</h2><p class="keksly-desc">${config.texts.banner.description}</p><div class="keksly-actions">${buttonsHtml}</div><div class="keksly-footer-links"><a href="${config.texts.links.privacyPolicy.url}" target="_blank">${config.texts.links.privacyPolicy.text}</a><a href="${config.texts.links.imprint.url}" target="_blank">${config.texts.links.imprint.text}</a></div>`;

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
                saveConsent(all, { source: 'banner', action: 'accept_all' });
            });
        }

        const rejectBtn = banner.querySelector('[data-action="reject"]');
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => {
                const req = {};
                config.services.forEach(s => req[s.id] = s.required);
                saveConsent(req, { source: 'banner', action: 'reject_all' });
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

        const servicesHtml = config.services.map(service => `<div class="keksly-category"><div class="keksly-cat-header"><span class="keksly-cat-title">${service.name}</span><label class="keksly-switch"><input type="checkbox" data-id="${service.id}" ${service.required ? 'checked disabled' : ''} ${consentState[service.id] ? 'checked' : ''}><span class="keksly-slider"></span></label></div><div class="keksly-cat-desc">${service.description}</div></div>`).join('');

        modal.innerHTML = `<div class="keksly-modal-content"><div class="keksly-modal-header"><h3>${config.texts.settings.title}</h3><button class="keksly-close">&times;</button></div><div class="keksly-modal-body">${servicesHtml}<div class="keksly-history-link"><button type="button" class="keksly-btn-text keksly-history-toggle">${config.texts.settings.historyLink}</button></div><div class="keksly-history-panel" style="display:none;"></div></div><div class="keksly-modal-footer"><button class="keksly-btn keksly-btn-secondary keksly-close-btn">${config.texts.settings.back}</button><button id="keksly-save" class="keksly-btn keksly-btn-primary">${config.texts.settings.save}</button></div></div>`;

        modal.classList.add('open');

        const close = () => modal.classList.remove('open');
        modal.querySelector('.keksly-close').addEventListener('click', close);
        modal.querySelector('.keksly-close-btn').addEventListener('click', close);

        document.getElementById('keksly-save').addEventListener('click', () => {
            const newState = {};
            modal.querySelectorAll('input[type="checkbox"]').forEach(input => {
                newState[input.getAttribute('data-id')] = input.checked;
            });
            saveConsent(newState, { source: 'settings', action: 'custom_save' });
        });

        const historyToggle = modal.querySelector('.keksly-history-toggle');
        const historyPanel = modal.querySelector('.keksly-history-panel');
        historyToggle.addEventListener('click', () => {
            if (historyPanel.style.display === 'none') {
                renderHistoryList(historyPanel);
                historyPanel.style.display = 'block';
            } else {
                historyPanel.style.display = 'none';
            }
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