import { randomBytes } from "crypto";
import ResolveRegister from "./resolveRegister.js";

export async function forwardRequest(name: any, mid: string, path: any, ws: WebSocket, req: any, res: any) {
    res.cookie('current_tunnel', name, { 
        path: '/',
        httpOnly: true,
        sameSite: 'lax' 
    });

    const cookieMap = new Map<string, string>(Object.entries(req.cookies));
    const cm = [];

    for (var i in req.cookies) {
        cm.push(i)
    }

    const message = {
        "messageId": mid,
        "method": req.method,
        "path": `/${(path && path.length > 0) ? (Array.isArray(path) ? path.join("/") : path) : ""}`,
        "query": req.query,
        "headers": req.headers,
        "cookies": req.cookies,
        "ip": req.ip,
        "body": req.body ?? ""
    };

    const m = JSON.stringify(message);
    ws.send(m);
}

export function generateMid(): string {
    const mid = `${randomBytes(7).toString('hex')}`
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

    if (ResolveRegister.getResolve(mid)==null) {
        return mid
    }

    return generateMid();
}