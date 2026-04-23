import ResolveRegister from "./resolveRegister.js";

export async function forwardRequest(message: Map<string, any>, ws: WebSocket) {
    const m = JSON.stringify(Object.fromEntries(message));
    ws.send(m);
}

export const waitForResponse = (messageId: string, ws: any) => new Promise((resolve) => {
    ResolveRegister.addResolve(messageId, resolve);
    ws.on("message", (message: any) => {
        const data = JSON.parse(message);
        if (data[messageId]!=null) {
            ResolveRegister.removeResolve(messageId);
            resolve(data[messageId]);
        }
    })
});