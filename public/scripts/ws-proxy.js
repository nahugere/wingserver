(function () {
    const OriginalWebSocket = window.WebSocket;

    const TUNNEL_HOST = window.location.host;
    const PROJECT_ID = window.location.pathname.match(
        /^\/tunnel\/([^/]+)(\/.*)?$/
    )?.[1];

    const ORIGIN_PORT = window.location.port;

    window.WebSocket = function (url, protocols) {
        let parsedUrl;

        try {
            parsedUrl = new URL(url, window.location.href);
        } catch (e) {
            return new OriginalWebSocket(url, protocols);
        }

        if (
            parsedUrl.hostname === "localhost" ||
            parsedUrl.hostname === "127.0.0.1"
        ) {
            if (!PROJECT_ID) {
                console.error(
                    "[tunnel] Cannot redirect WebSocket: project ID not found in page URL."
                );

                return new OriginalWebSocket(url, protocols);
            }

            const CLIENT_ID = crypto.randomUUID()
                .replace(/-/g, "")
                .slice(0, 10);

            const targetPort =
                parsedUrl.port || ORIGIN_PORT || "0000";

            const tunnelProtocol =
                window.location.protocol === "https:" ? "wss:" : "ws:";

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