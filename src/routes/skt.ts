// TODO: Implement Redis Pub/Sub for better communication with workers
import { WebSocketServer, WebSocket } from "ws";
import ResponseMap from "../services/responseMap.js";
import DevConnections from "../services/devConnections.js";
import type { Response } from "express";
import { stringify } from "querystring";

var vmSessions: Map<string, any> = new Map();
const vmWss = new WebSocketServer({ noServer: true });
const wss = new WebSocketServer({ noServer: true });

function addVmSession(ws: any, projId: any, role: any, clientId: any = null, params: any, port: any, ) {
    var x = vmSessions.get(projId);

    if (role === "agent") {
        x.set("agent", ws);
        return;
    }
    
    x.get("clients")[clientId] = ws;
    const agent = x.get("agent");
    
    agent?.send(JSON.stringify({
        port,
        clientId,
        params,
        "isBinary": false,
        "sendMessage": false,
        "message": ""
    }))
}
export const wsRoutes: Record<string, WebSocketServer> = {
    "ws": wss,
    "vmws": vmWss
};

function writeWithBackpressure(ws: WebSocket, res: Response, data: Buffer) {
    if (res.writableEnded || res.destroyed) return;

    var ok = res.write(data);
    if (ok) return;

    ws.pause()
    const release = () => {
        res.off("drain", release);
        res.off("close", release);
        ws.resume()
    }
    res.once("drain", release);
    res.once("close", release);
}

export function initWS() {
    wss.on("connection", async (ws, req) => {

        console.log("Client connected");

        ws.on("message", (message: any) => {
            try {
                const metaLen = message.readUInt32BE(0)
            
                const metaBuffer = message.slice(4, 4 + metaLen);
                const meta = JSON.parse(metaBuffer.toString('utf-8'));
                
                var data = message.slice(4 + metaLen)
                
                const status = meta["status"];

                const res = ResponseMap.getResponse(meta["messageId"])
                
                if (res==null) return;

                if (status==304) {
                    res.end()
                    return;
                }
                
                if (!res.headersSent) {
                    res.writeHead(status, meta["headers"])
                }

                if (
                    Object.values(meta.headers).some((v: any) => v.includes("text/html"))
                ) {

                    const html = data.toString("utf8");

                    const modified = html.replace(
                        /<head(\s[^>]*)?>/i,
                        (m: any) => `${m}<script src="/scripts/ws-proxy.js"></script>`
                    );
                    // res.write(data);
                    writeWithBackpressure(ws, res, Buffer.from(modified));
                } else {
                    // res.write(data);
                    writeWithBackpressure(ws, res, data);
                }
                
                if (meta["isLast"]) {
                    res?.end()
                }
            } catch (error) {
                DevConnections.removeConnection(ws);
            }
        })

        ws.on("close", () => {
            DevConnections.removeConnection(ws);
        })
    })
}

export function iniVmWS() {
    console.log(`Running WS Service`)

    vmWss.on("connection", async (ws, req) => {
        const role = req.headers["x-wing-role"];
        const rawUrl = req.url || '/';
        const urls = rawUrl.split("/").slice(1)

        if (rawUrl === "/") {
            ws.close(1014, "Bad Request")
            return
        }

        const [, projectId, port, clientId, ...params] = urls
        
        if (!vmSessions.has(projectId)) {
            vmSessions.set(projectId, new Map([
                ["agent", null],
                ["clients", {}]
            ]))
        }

        addVmSession(ws, projectId, role, clientId, params, port)
        const session = vmSessions.get(projectId)

        if (session.get("agent")==null) {
            ws.send("Local connection has been disconnected")
            ws.close()
        }

        ws.on("message", (message: any, isBinary: boolean) => {
            if (role === "agent") {
                const parsed = JSON.parse(message.toString('utf-8'))
                const data = parsed.isBinary 
                    ? Buffer.from(parsed.message, 'base64') 
                    : parsed.message
                session.get("clients")[parsed.clientId].send(data, { binary: parsed.isBinary })
            } else {
                var agent = session.get("agent");
                if (agent !== null) {
                    var sendMessage = true;
                    agent.send(JSON.stringify({ 
                        port, 
                        clientId, 
                        params,
                        isBinary, 
                        sendMessage,
                        message: isBinary ? message.toString('base64') : message.toString('utf-8')
                    }))
                }
            }
        })

        ws.on("close", (code: any, reason: any) => {
            if (role === "agent") {
                vmSessions.delete(projectId)
                return
            }
            const clientsList = session.get("clients")
            if (clientsList) {
                delete clientsList[clientId]
            }
        })
    })
    
}