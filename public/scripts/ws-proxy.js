(function() {
    const OriginalWebSocket = window.WebSocket;
    const TUNNEL_HOST = location.hostname;
    const TUNNEL_PORT = 21321;
    const PROJECT_ID = window.location.pathname.match(/^\/tunnel\/([^/]+)(\/.*)?$/)[1];
    const ORIGIN_PORT = location.port; 

    window.WebSocket = function(url, protocols) {
        let parsedUrl;
        try { parsedUrl = new URL(url); } catch(e) {}

        if (parsedUrl && parsedUrl.hostname === 'localhost') {
            const CLIENT_ID = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
            const tunnelUrl = `ws://${TUNNEL_HOST}:${TUNNEL_PORT}/${PROJECT_ID}`
                + `/${parsedUrl.port || ORIGIN_PORT}/`
                + CLIENT_ID
                + parsedUrl.pathname
                + parsedUrl.search;

            console.debug('[tunnel] Redirecting VM Service WS:', url, '->', tunnelUrl);
            return new OriginalWebSocket(tunnelUrl, protocols);
        }

        return new OriginalWebSocket(url, protocols);
    };

    Object.assign(window.WebSocket, OriginalWebSocket);
    window.WebSocket.prototype = OriginalWebSocket.prototype;
})();