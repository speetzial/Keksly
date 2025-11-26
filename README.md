# 🍪 Keksly

**The lightweight, developer-friendly Cookie Consent Banner for the modern web.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Size](https://img.shields.io/badge/size-<20kb-green.svg)
![Dependencies](https://img.shields.io/badge/dependencies-none-success.svg)

Keksly is a zero-dependency, fully customizable cookie consent solution designed for GDPR compliance and Google Consent Mode v2 support. It replaces complex category-based systems with a transparent **Service-based** model, giving your users clear control over what they consent to.

## ✨ Features

- **🛡️ Google Consent Mode v2**: Built-in support for Advanced Mode. Automatically maps services to GCM signals (`ad_storage`, `analytics_storage`, etc.).
- **🔧 Service-Based Consent**: Users consent to specific services (e.g., "Google Analytics", "Facebook Pixel") rather than vague categories.
- **🎨 Fully Customizable**: Configure colors, fonts, texts, and positions to match your brand.
- **🚫 Automatic Script Blocking**: Easily block third-party scripts until consent is granted.
- **📱 Responsive Design**: Looks great on mobile and desktop.

## 📦 Installation

### Option 1: CDN (Recommended)
Simply add the script to your `<head>` tag.

```html
<script src="https://cdn.jsdelivr.net/gh/speetzial/Keksly@main/keksly.js"></script>
```

### Option 2: Self-Hosted
Download `keksly.js` and host it on your own server.

```html
<script src="/path/to/keksly.js"></script>
```

## 🚀 Quick Start

1.  **Define your configuration** before loading Keksly.
2.  **Load Keksly**.

```html
<head>
    <!-- 1. Configuration -->
    <script>
        window.KekslyConfig = {
            services: [
                {
                    id: 'google_analytics',
                    name: 'Google Analytics',
                    description: 'Tracks website usage and performance.',
                    required: false,
                    enabled: false,
                    category: ['analytics_storage'] // Maps to GCM
                },
                {
                    id: 'google_ads',
                    name: 'Google Ads',
                    description: 'Personalized advertising.',
                    required: false,
                    enabled: false,
                    category: ['ad_storage', 'ad_user_data', 'ad_personalization']
                }
            ],
            texts: {
                banner: {
                    title: 'We value your privacy',
                    description: 'We use cookies to improve your experience. Select the services you consent to.'
                }
            }
        };
    </script>

    <!-- 2. Load Keksly -->
    <script src="keksly.js"></script>
</head>
```

## 🛠️ Configuration

Keksly is configured via `window.KekslyConfig`.

### `services` (Array)
Define the services your website uses.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique identifier for the service (e.g., `google_analytics`). |
| `name` | `string` | Display name shown to the user. |
| `description` | `string` | Brief description of what the service does. |
| `required` | `boolean` | If `true`, the user cannot disable this service (e.g., for essential functionality). |
| `enabled` | `boolean` | Default state (should be `false` for GDPR compliance). |
| `category` | `string[]` | Array of Google Consent Mode types this service maps to. |

**Supported GCM Categories:**
- `ad_storage`
- `ad_user_data`
- `ad_personalization`
- `analytics_storage`
- `functionality_storage`
- `personalization_storage`
- `security_storage`

### `design` (Object)
Customize the look and feel.

```javascript
design: {
    primaryColor: '#3b82f6', // Button and toggle color
    backgroundColor: '#ffffff', // Banner background
    textColor: '#1f2937', // Text color
    fontFamily: 'system-ui, sans-serif', // Font stack
    position: 'bottom', // 'bottom' or 'center' (center adds a backdrop)
    buttons: [
        { type: 'accept', label: 'Accept All', variant: 'primary' },
        { type: 'reject', label: 'Reject All', variant: 'secondary' },
        { type: 'settings', label: 'Customize', variant: 'text' }
    ]
}
```

### `design.buttons` (Array)
Customize the order, text, and style of buttons.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | Action type: `'accept'`, `'reject'`, or `'settings'`. |
| `label` | `string` | Text to display on the button. |
| `variant` | `string` | Style variant: `'primary'`, `'secondary'`, or `'text'`. |

## 🔒 Script Blocking

To block a script until a specific service is consented, change `type="text/javascript"` to `type="text/plain"` and add the `data-service` attribute.

```html
<!-- This script will only run if 'google_analytics' is accepted -->
<script type="text/plain" data-service="google_analytics" src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>

<script type="text/plain" data-service="google_analytics">
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## 📡 API

Keksly exposes a global API for manual control.

- `window.Keksly.openSettings()`: Opens the preferences modal.
- `window.Keksly.reset()`: Clears consent and reloads the page.

## 📄 License

MIT License. Feel free to use Keksly in personal and commercial projects.
