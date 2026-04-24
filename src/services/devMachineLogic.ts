import ResolveRegister from "./resolveRegister.js";

export async function forwardRequest(message: any, ws: WebSocket) {
    const m = JSON.stringify(message);
    ws.send(m);
}

export const waitForResponse = (messageId: string, ws: any) => new Promise((resolve) => {
    ResolveRegister.addResolve(messageId, resolve);
    ws.on("message", (message: any) => {
        const data = JSON.parse(message);
        if (data["messageId"]==messageId) {
            ResolveRegister.removeResolve(messageId);
            resolve({
                "status": data["status"],
                "binary": data["isBase64"],
                "headers": data["headers"],
                // ! Dart uses "content-type" while html uses "Content-Type"
                "contentType": data["headers"]["content-type"],
                "body": data["body"]
            });
        }
    })
});