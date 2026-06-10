import SwiftUI
import WebKit
import AuthenticationServices

struct AppConfiguration: Codable {
    let vercelBackendDomain: String
    let webShellUrl: String
    let requiredAssets: [String] // You can leave this empty now if you want!
}

struct ContentView: View {
    @State private var appConfig: AppConfiguration? = nil
    @State private var webViewReady = false
    @State private var errorMessage: String? = nil

    // CONFIGURATION TARGETS: Change these to match your setup!
    private let proxyEndpoint = "https://bmfbnydcanksjwquljzb.supabase.co/functions/v1/proxy-api"
    private let manifestUrl = "https://raw.githubusercontent.com/Cooldude1259/my-social-media/main/app-manifest.json"

    var body: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()

            if let config = appConfig {
                // The new custom-routed browser loop
                CustomSchemeWebView(configuration: config, proxy: proxyEndpoint, isReady: $webViewReady, error: $errorMessage)
                    .ignoresSafeArea()
                    .opacity(webViewReady ? 1 : 0)
            }

            if !webViewReady && errorMessage == nil {
                VStack(spacing: 15) {
                    ProgressView().scaleEffect(1.3)
                    Text("Bootstrapping network layers...").font(.caption).foregroundColor(.secondary).bold()
                }
            }

            if let error = errorMessage {
                VStack(spacing: 8) {
                    Image(systemName: "wifi.slash").font(.title).foregroundColor(.red)
                    Text("Initialization Failed").font(.headline)
                    Text(error).font(.caption).foregroundColor(.secondary)
                }
            }
        }
        .task {
            guard let url = URL(string: proxyEndpoint) else { return }
            var req = URLRequest(url: url)
            req.setValue(manifestUrl, forHTTPHeaderField: "x-target-url")
            req.setValue("application/json", forHTTPHeaderField: "x-content-type")

            do {
                let (data, res) = try await URLSession.shared.data(for: req)
                if (res as? HTTPURLResponse)?.statusCode == 200 {
                    self.appConfig = try JSONDecoder().decode(AppConfiguration.self, from: data)
                } else {
                    self.errorMessage = "Proxy rejected manifest fetch."
                }
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }
}

// --- THE WEB VIEW SCHEME INTERCEPTOR ---
struct CustomSchemeWebView: UIViewRepresentable {
    let configuration: AppConfiguration
    let proxy: String
    @Binding var isReady: Bool
    @Binding var error: String?

    // Supabase project used for Google sign-in. The redirect scheme below must
    // be added to your Supabase Auth "Redirect URLs" allow-list.
    static let supabaseUrl = "https://bmfbnydcanksjwquljzb.supabase.co"
    static let authCallbackScheme = "socialmedia"
    static let authCallbackUrl = "socialmedia://login-callback"

    func makeCoordinator() -> Coordinator {
        Coordinator(isReady: $isReady, error: $error)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // Register the custom "app" scheme handler
        let handler = CustomSchemeHandler(proxyEndpoint: proxy, backendDomain: configuration.vercelBackendDomain)
        config.setURLSchemeHandler(handler, forURLScheme: "app")

        // Bridge so the web app can ask the native layer to run Google sign-in.
        config.userContentController.add(context.coordinator, name: "nativeAuth")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.navigationDelegate = context.coordinator
        context.coordinator.webView = webView

        // Kickoff our custom browser target directly to our custom scheme root
        if let rootUrl = URL(string: "app://root/index.html") {
            webView.load(URLRequest(url: rootUrl))
            // isReady is now set by the navigation delegate once the page actually loads
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    // MARK: - Navigation Delegate + Auth Bridge
    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {
        @Binding var isReady: Bool
        @Binding var error: String?
        weak var webView: WKWebView?
        private var authSession: ASWebAuthenticationSession?

        init(isReady: Binding<Bool>, error: Binding<String?>) {
            _isReady = isReady
            _error = error
        }

        // MARK: Navigation
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async { self.isReady = true }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async { self.error = error.localizedDescription }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async { self.error = error.localizedDescription }
        }

        // MARK: JS -> Native messages
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "nativeAuth",
                  let body = message.body as? [String: Any],
                  let action = body["action"] as? String else { return }

            switch action {
            case "signIn":
                startGoogleSignIn()
            case "signOut":
                // Supabase session lives in the web layer; nothing to clear natively.
                break
            default:
                break
            }
        }

        // MARK: Native Google sign-in via the system browser (which Google allows,
        // unlike the embedded webview).
        private func startGoogleSignIn() {
            guard let redirect = CustomSchemeWebView.authCallbackUrl
                    .addingPercentEncoding(withAllowedCharacters: .urlQueryValueAllowed),
                  let authUrl = URL(string:
                    "\(CustomSchemeWebView.supabaseUrl)/auth/v1/authorize?provider=google&redirect_to=\(redirect)")
            else { return }

            let session = ASWebAuthenticationSession(
                url: authUrl,
                callbackURLScheme: CustomSchemeWebView.authCallbackScheme
            ) { [weak self] callbackURL, error in
                guard let self = self else { return }
                if let error = error {
                    print("Google sign-in cancelled/failed: \(error.localizedDescription)")
                    return
                }
                guard let callbackURL = callbackURL else { return }
                self.handleAuthCallback(callbackURL)
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.authSession = session
            session.start()
        }

        // Supabase returns the session as a URL fragment:
        //   socialmedia://login-callback#access_token=...&refresh_token=...
        private func handleAuthCallback(_ url: URL) {
            let fragment = URLComponents(string: url.absoluteString)?.fragment ?? ""
            var params: [String: String] = [:]
            for pair in fragment.split(separator: "&") {
                let kv = pair.split(separator: "=", maxSplits: 1).map(String.init)
                if kv.count == 2 {
                    params[kv[0]] = kv[1].removingPercentEncoding ?? kv[1]
                }
            }
            guard let access = params["access_token"],
                  let refresh = params["refresh_token"] else {
                print("Auth callback missing tokens: \(url.absoluteString)")
                return
            }
            // Hand the session to the web app's supabase-js client.
            let safeAccess = access.replacingOccurrences(of: "'", with: "")
            let safeRefresh = refresh.replacingOccurrences(of: "'", with: "")
            let js = "window.onNativeAuth('\(safeAccess)', '\(safeRefresh)')"
            DispatchQueue.main.async {
                self.webView?.evaluateJavaScript(js, completionHandler: nil)
            }
        }

        // MARK: Presentation anchor for ASWebAuthenticationSession
        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            return webView?.window ?? ASPresentationAnchor()
        }
    }
}

// --- THE INTERPOLATION CUSTOM HANDLER ENGINE ---
class CustomSchemeHandler: NSObject, WKURLSchemeHandler {
    let proxyEndpoint: String
    let backendDomain: String

    private let githubBaseRepoPath = "https://raw.githubusercontent.com/Cooldude1259/my-social-media/main/"

    init(proxyEndpoint: String, backendDomain: String) {
        self.proxyEndpoint = proxyEndpoint
        self.backendDomain = backendDomain
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let requestUrl = urlSchemeTask.request.url?.absoluteString ?? ""

        // 1. Parse the path being requested (e.g. app://root/dashboard.html -> dashboard.html)
        let rawPath = requestUrl.replacingOccurrences(of: "app://root/", with: "")
        // Strip any query string / fragment so MIME detection and the upstream
        // GitHub fetch use the bare file path. (OAuth redirects can append
        // "?code=..." which would otherwise break the .html suffix check.)
        let cleanPath = rawPath
            .components(separatedBy: "?").first?
            .components(separatedBy: "#").first ?? rawPath
        let targetGithubUrl = "\(githubBaseRepoPath)\(cleanPath)"

        // 2. Identify the content-type header rules dynamically based on the file type
        var mimeType = "text/plain"
        if cleanPath.hasSuffix(".html") { mimeType = "text/html" }
        else if cleanPath.hasSuffix(".js") { mimeType = "application/javascript" }
        else if cleanPath.hasSuffix(".css") { mimeType = "text/css" }
        else if cleanPath.hasSuffix(".json") { mimeType = "application/json" }
        else if cleanPath.hasSuffix(".png") { mimeType = "image/png" }
        else if cleanPath.hasSuffix(".jpg") || cleanPath.hasSuffix(".jpeg") { mimeType = "image/jpeg" }
        else if cleanPath.hasSuffix(".svg") { mimeType = "image/svg+xml" }
        else if cleanPath.hasSuffix(".woff2") { mimeType = "font/woff2" }
        else if cleanPath.hasSuffix(".woff") { mimeType = "font/woff" }
        // An empty path (app://root/) is the index document.
        else if cleanPath.isEmpty { mimeType = "text/html" }

        let resolvedMimeType = mimeType

        Task {
            guard let pUrl = URL(string: proxyEndpoint) else {
                await MainActor.run {
                    urlSchemeTask.didFailWithError(URLError(.badURL))
                }
                return
            }
            var req = URLRequest(url: pUrl)
            req.setValue(targetGithubUrl, forHTTPHeaderField: "x-target-url")
            req.setValue(resolvedMimeType, forHTTPHeaderField: "x-content-type")

            do {
                let (data, _) = try await URLSession.shared.data(for: req)
                var finalData = data

                // 3. Injection Optimization for HTML pages
                if resolvedMimeType == "text/html", var htmlString = String(data: data, encoding: .utf8) {
                    let injection = "<script>window.VERCEL_BACKEND = 'https://\(self.backendDomain)';</script>"
                    htmlString = htmlString.replacingOccurrences(of: "<head>", with: "<head>\(injection)")

                    if let injectedData = htmlString.data(using: .utf8) {
                        finalData = injectedData
                    }
                }

                // 4. Feed the data stream response back into the web viewer — using the correct MIME type per asset
                let response = URLResponse(
                    url: urlSchemeTask.request.url!,
                    mimeType: resolvedMimeType,
                    expectedContentLength: finalData.count,
                    textEncodingName: "utf-8"
                )

                await MainActor.run {
                    urlSchemeTask.didReceive(response)
                    urlSchemeTask.didReceive(finalData)
                    urlSchemeTask.didFinish()
                }
            } catch {
                print("Failed to stream asset: \(cleanPath) — \(error)")
                await MainActor.run {
                    urlSchemeTask.didFailWithError(error)
                }
            }
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}
