// (function() {
//     const OriginalWebSocket = window.WebSocket;
//     const TUNNEL_HOST = location.host;
//     const PROJECT_ID = window.location.pathname.match(/^\/tunnel\/([^/]+)(\/.*)?$/)[1];
//     const ORIGIN_PORT = location.port; 

//     window.WebSocket = function(url, protocols) {
//         let parsedUrl;
//         try { parsedUrl = new URL(url); } catch(e) {}

//         try {
//             const CLIENT_ID = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
//             const tunnelUrl = `ws://${TUNNEL_HOST}/vmws/${PROJECT_ID}`
//                 + `/${parsedUrl.port || ORIGIN_PORT}/`
//                 + CLIENT_ID
//                 + parsedUrl.pathname
//                 + parsedUrl.search;

//             console.debug('[tunnel] Redirecting VM Service WS:', url, '->', tunnelUrl);
//             return new OriginalWebSocket(tunnelUrl, protocols);
//         } catch {
//             console.error("There has been an error accessing WebSocket endpoint. Please reload the page since some functionalities may not operate properly.")
//             return new OriginalWebSocket(url, protocols);
//         }
//     };

//     Object.assign(window.WebSocket, OriginalWebSocket);
//     window.WebSocket.prototype = OriginalWebSocket.prototype;
// })();
(function () {
    const OriginalWebSocket = window.WebSocket;
    const TUNNEL_HOST = window.location.host;
    const PAGE_PROTOCOL = window.location.protocol;
    const match = window.location.pathname.match(
        /^\/tunnel\/([^/]+)(?:\/.*)?$/
    );
    const PROJECT_ID = match
        ? match[1]
        : window.location.pathname.split("/").filter(Boolean)[0] || "";
    const ORIGIN_PORT = window.location.port;

    window.WebSocket = function (url, protocols) {
        let parsedUrl;

        try {
            parsedUrl = new URL(url, window.location.href.replace(/^http/, "ws"));
        } catch (e) {
            return new OriginalWebSocket(url, protocols);
        }

        if (
            parsedUrl.hostname === "localhost" ||
            parsedUrl.hostname === "127.0.0.1"
        ) {
            if (!PROJECT_ID) {
                console.error("[tunnel] Cannot redirect WebSocket: missing project ID.");
                return new OriginalWebSocket(url, protocols);
            }

            const CLIENT_ID = crypto.randomUUID()
                .replace(/-/g, "")
                .slice(0, 10);

            const targetPort = parsedUrl.port || ORIGIN_PORT;

            const tunnelProtocol = PAGE_PROTOCOL === "https:" ? "wss:" : "ws:";

            const tunnelUrl =
                `${tunnelProtocol}//${TUNNEL_HOST}/vmws/${PROJECT_ID}` +
                `/${targetPort}/${CLIENT_ID}` +
                `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;

            console.debug(
                "[tunnel] Redirecting VM Service WS:",
                url,
                "->",
                tunnelUrl
            );

            return new OriginalWebSocket(tunnelUrl, protocols);
        }

        return new OriginalWebSocket(url, protocols);
    };

    Object.assign(window.WebSocket, OriginalWebSocket);
    window.WebSocket.prototype = OriginalWebSocket.prototype;
})();