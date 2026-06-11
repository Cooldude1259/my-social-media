# Google Auth Setup (ConnectEd Cloud)

ConnectEd uses Supabase Auth with Google as the identity provider. The app
runs inside a `WKWebView` under a custom `app://root` origin, and **Google
blocks OAuth inside embedded webviews**, so sign-in is built two ways:

- **Native bridge (iOS app):** Swift opens Google in an
  `ASWebAuthenticationSession` (the system browser, which Google allows), then
  injects the Supabase session into the web app. See `ios/ContentView.swift`.
- **Browser fallback (`app/index.html`):** a standard
  `supabase.auth.signInWithOAuth({ provider: 'google' })` redirect, used when
  the page is opened outside the embedded webview.

## What you need to configure in the dashboards

Most of this is already done (the Google provider is enabled). Confirm these:

### 1. Supabase → Authentication → Providers → Google
- Enabled, with the **Client ID** and **Client Secret** from your Google
  Cloud OAuth client.

### 2. Supabase → Authentication → URL Configuration → Redirect URLs
Add **both** of these so the redirects are allowed:

```
socialmedia://login-callback
app://root/app/index.html
https://cooldude1259.github.io/my-social-media/app/index.html
```

- `socialmedia://login-callback` — used by the native iOS sign-in
  (`ASWebAuthenticationSession`). It must match `authCallbackUrl` in
  `ios/ContentView.swift`.
- `app://root/app/index.html` — used by the iOS in-webview fallback.
- `https://cooldude1259.github.io/my-social-media/app/index.html` — used when
  the site is served as GitHub Pages in a normal browser. (Adjust if your
  Pages URL differs.)

### 3. Google Cloud Console → Credentials → OAuth 2.0 Client
- **Authorized redirect URI** must include the Supabase callback:
  `https://bmfbnydcanksjwquljzb.supabase.co/auth/v1/callback`

## How profiles work

On first Google sign-in, a row is auto-created in
`social-media-public.Users` (via the `handle_new_user` trigger) using the
Google `full_name` and `avatar_url`. The web client also has a safety-net
upsert. Posts are linked to that profile and can only be created by the
signed-in owner; reads stay public.

## Runs both as the iOS app and as GitHub Pages

The same files work in both environments:

- **iOS app:** pages load under the custom `app://root` scheme (proxied from
  GitHub). Sign-in uses the native `ASWebAuthenticationSession` bridge.
- **GitHub Pages:** the site is plain static hosting. Sign-in falls back to the
  standard `supabase.auth.signInWithOAuth` redirect (no native shell present).

This works because all internal links and asset references are
**document-relative** (e.g. `../style.css`, `app/index.html`) rather than
absolute `app://root/...` URLs — relative URLs resolve correctly under both the
`app://` scheme and the `https://.../my-social-media/` Pages path. The web app
also auto-detects the environment via `window.webkit.messageHandlers.nativeAuth`
and `window.location` for the auth redirect target.

### Enabling GitHub Pages
Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
branch `main`, folder `/ (root)`. The site will be served at
`https://cooldude1259.github.io/my-social-media/`. No build step is required.

## Notes / limitations

- `localStorage` can be unreliable under the custom `app://` scheme, so the
  web session may not persist across app launches. The native bridge can
  re-inject the session on launch if you later store the refresh token in the
  Keychain.
- The app loads files from the **`main`** branch of this repo (see the proxy
  in `ios/ContentView.swift`), so these changes take effect once merged to
  `main`.
