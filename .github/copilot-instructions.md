# Keksly - AI Coding Instructions

## Project Overview

Keksly is a **zero-dependency, vanilla JavaScript** cookie consent banner library with Google Consent Mode v2 support. It uses a **service-based consent model** (not category-based) for GDPR compliance.

## Architecture

### Core File: `keksly.js`
Single IIFE (Immediately Invoked Function Expression) containing all logic:
- **Configuration**: `defaultConfig` object merged with user's `window.KekslyConfig`
- **State Management**: `consentState` object stored in `localStorage` under key `keksly_consent`
- **GCM Integration**: Maps service categories to Google Consent Mode signals (`ad_storage`, `analytics_storage`, etc.)
- **Script Blocking**: Activates blocked scripts (`type="text/plain" data-service="..."`) when consent is granted

### Key Functions Flow
```
init() → loadConsent() → injectStyles() → showBanner() or applyConsent()
                                              ↓
                                    saveConsent() → applyConsent() → pushDataLayer() + updateGcm() + handleScriptBlocking()
```

### Public API (exposed on `window.Keksly`)
- `openSettings()` - Opens preferences modal
- `reset()` - Clears consent, reloads page

## File Structure

| File | Purpose |
|------|---------|
| `keksly.js` | Core library (448 lines) - all logic in single file |
| `index.html` | Marketing landing page with live demo |
| `generator.html` | Interactive config builder tool |
| `CNAME` | GitHub Pages custom domain |

## Development Patterns

### Configuration Structure
Services must include these properties:
```javascript
{
  id: 'unique_id',           // Used for localStorage and script blocking
  name: 'Display Name',
  description: 'User-facing description',
  required: boolean,         // Cannot be disabled if true
  enabled: boolean,          // Default state (false for GDPR)
  category: ['gcm_type']     // Maps to GCM signals
}
```

### GCM Category Mapping
Valid categories: `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`, `functionality_storage`, `personalization_storage`, `security_storage`

### CSS Injection
All styles are injected dynamically via `injectStyles()` - no external CSS files. Styles use design config values for theming.

### Z-Index Strategy
- Banner: `2147483647` (max safe integer)
- Modal: `2147483648`
- Backdrop: `2147483646`

## Testing & Development

- **No build step** - Edit files directly
- **Local testing**: Open `index.html` in browser (or use local server for fetch-based config)
- **CDN delivery**: Via jsDelivr from GitHub (`https://cdn.jsdelivr.net/gh/speetzial/Keksly@main/keksly.js`)

## Code Conventions

- Use `'use strict'` at IIFE start
- All DOM elements prefixed with `keksly-` (IDs and classes)
- Deep merge for config: user config overrides defaults
- Required services always have consent set to `true`
- DataLayer events use `keksly_consent_update` event name

## When Modifying

1. **Adding new GCM categories**: Update `updateGcm()` function's `gcmStatus` object
2. **New design options**: Add to `defaultConfig.design` and update `injectStyles()` CSS
3. **New button types**: Handle in `showBanner()` event listeners
4. **Changing storage**: Modify `loadConsent()` and `saveConsent()` functions
