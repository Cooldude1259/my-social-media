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
```

- `socialmedia://login-callback` — used by the native iOS sign-in
  (`ASWebAuthenticationSession`). It must match `authCallbackUrl` in
  `ios/ContentView.swift`.
- `app://root/app/index.html` — used by the in-webview / browser fallback.

### 3. Google Cloud Console → Credentials → OAuth 2.0 Client
- **Authorized redirect URI** must include the Supabase callback:
  `https://bmfbnydcanksjwquljzb.supabase.co/auth/v1/callback`

## How profiles work

On first Google sign-in, a row is auto-created in
`social-media-public.Users` (via the `handle_new_user` trigger) using the
Google `full_name` and `avatar_url`. The web client also has a safety-net
upsert. Posts are linked to that profile and can only be created by the
signed-in owner; reads stay public.

## Notes / limitations

- `localStorage` can be unreliable under the custom `app://` scheme, so the
  web session may not persist across app launches. The native bridge can
  re-inject the session on launch if you later store the refresh token in the
  Keychain.
- The app loads files from the **`main`** branch of this repo (see the proxy
  in `ios/ContentView.swift`), so these changes take effect once merged to
  `main`.
