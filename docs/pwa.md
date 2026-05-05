# PWA Support – Alife Church

This document covers the Progressive Web App (PWA) implementation for the Alife Church frontend, including device-specific considerations for iOS/iPhone.

## Overview

The app is configured as a standalone PWA so users can install it to their home screen on both Android and iOS. Key PWA features include:

| Feature | Status |
|---|---|
| Web App Manifest | ✅ `/manifest.json` |
| Service Worker | ✅ `/sw.js` (cache-first for assets, cache-first for API) |
| Offline shell | ✅ Cached app shell returned when offline |
| Home screen install | ✅ Android prompt + iOS "Add to Home Screen" |
| Splash screens | ✅ Apple touch startup images for all modern iPhones & iPads |
| App icons | ✅ 72–512 px, including `apple-touch-icon` tags |

## Manifest

The manifest (`public/manifest.json`) uses:

- **name**: `Alife Church`
- **short_name**: `Alife`
- **display**: `standalone`
- **background_color / theme_color**: `#003366`
- **orientation**: `portrait-primary`

Icons list both `any` and `maskable` purpose entries so Android adaptive icons work correctly while remaining backward-compatible with browsers that don't support `purpose`.

## Service Worker

`public/sw.js` is a hand-written service worker (no workbox dependency) that:

1. **Pre-caches** the app shell (`/`, `/manifest.json`, key icons) on install.
2. Uses a **cache-first** strategy for static assets (JS, CSS, images).
3. Uses a **network-first** strategy for `/api/*` calls, falling back to cached responses when offline.
4. Returns the cached `/` for navigation requests when offline, allowing the SPA router to render its own offline UI.
5. Cleans up old caches when a new service worker version activates.
6. Listens for silent Web Push `ENTITY_UPDATED` payloads, refreshes the affected cached API response, stores version stamps in IndexedDB, and broadcasts update messages on the `api-updates` channel.
7. Accepts `SYNC_CHECK` messages from the React app so missed push notifications are self-healed through `/api/sync/versions`, which proxies the Cloudflare KV version store.

### Updating the cache

Increment the `CACHE_NAME` version string (e.g. `alife-cache-v2`) in `sw.js` whenever you want clients to discard old caches after a deploy.

## iOS / iPhone Compatibility

### Meta tags (in `index.html`)

| Tag | Purpose |
|---|---|
| `apple-mobile-web-app-capable` | Enables standalone mode on iOS |
| `apple-mobile-web-app-status-bar-style` | `black-translucent` blends with the app theme |
| `apple-mobile-web-app-title` | Name shown under the home screen icon |
| `apple-touch-icon` (multiple sizes) | Home screen icon for older iOS that ignores the manifest |
| `apple-touch-startup-image` (per device) | Splash screen while the app loads |
| `viewport-fit=cover` | Extends content behind the notch/home indicator |

### Safe area insets

CSS `env(safe-area-inset-*)` padding is applied to `<body>` so content doesn't overlap the notch or home indicator on iPhones with edge-to-edge screens.

### Overscroll bounce

`overscroll-behavior-y: none` on `<body>` prevents the rubber-band bounce effect in standalone mode which can be disorienting.

## Known iOS Limitations & Workarounds

### Service Worker support

- **iOS < 11.3**: No service worker support at all. The `registerSW.ts` helper checks for `navigator.serviceWorker` before attempting registration, so the app works as a normal website on these older versions.
- **iOS 11.3–13**: Service workers are supported but have limited cache storage (typically ~50 MB) and may be purged after a few weeks of inactivity.

### No install prompt

iOS Safari does not fire the `beforeinstallprompt` event. Users must manually tap **Share → Add to Home Screen**. Consider adding an in-app banner that detects iOS Safari and shows instructions.

**Detection snippet** (already safe for older iOS):

```js
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || ('standalone' in navigator && navigator.standalone);

if (isIos && !isStandalone) {
  // Show "Add to Home Screen" instructions
}
```

### Push notifications

- Push notifications via the Web Push API are **not supported** on iOS < 16.4.
- On iOS 16.4+ push is only available when the user has added the app to their home screen.

### Background sync

`SyncManager` is not available on any version of iOS Safari. Avoid relying on background sync; instead retry failed requests when the app regains connectivity.

### Fixed positioning quirks

When the iOS keyboard opens, `position: fixed` elements can shift. A common workaround is to use `position: sticky` or listen for `visualViewport` resize events and adjust layout accordingly.

### 300 ms tap delay

Modern iOS (≥ 9.3) removes the 300 ms delay when `viewport` has `width=device-width`. The current `index.html` viewport tag already includes this.

## Icon Sizes

| Size | Used By |
|---|---|
| 72×72 | Older Android |
| 96×96 | Older Android |
| 120×120 | iPhone (iOS ≤ 6 retina) |
| 128×128 | Chrome Web Store |
| 144×144 | Windows tile / older iPads |
| 152×152 | iPad (iOS 7+) |
| 180×180 | iPhone (iOS 8+ retina) |
| 192×192 | Android / Chrome |
| 384×384 | Android splash |
| 512×512 | Android splash / PWA install |

## Testing Checklist

- [ ] Chrome DevTools → Application → Manifest shows valid manifest
- [ ] Lighthouse PWA audit passes
- [ ] Android: install prompt appears; app launches in standalone mode
- [ ] iPhone SE (iOS 12+): "Add to Home Screen" works; splash + icon correct
- [ ] iPhone X/11/12/13/14/15: same as above, plus notch area handled
- [ ] iPad: icon and splash display correctly
- [ ] Offline: app shell loads; API calls show cached data or offline UI
