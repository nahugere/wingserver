// TODO: Implement Redis Pub/Sub for better communication with workers
import { WebSocketServer } from "ws";
import ResponseMap from "../services/responseMap.js";
import DevConnections from "../services/devConnections.js";
import { stringify } from "querystring";

const wsPort = 5432;
var vmSessions: Map<string, any> = new Map();

export const vmWss = new WebSocketServer({port: wsPort});
export const wss = new WebSocketServer({ noServer: true });

export function initWS() {
    wss.on("connection", async (ws, req) => {
        console.log("Client connected");

        // TODO: Implement logic to remove unwanted register and devconnection instances on disconnect
        ws.on("message", (message: any) => {
            const metaLen = message.readUInt32BE(0)
            
            const metaBuffer = message.slice(4, 4 + metaLen);
            const meta = JSON.parse(metaBuffer.toString('utf-8'));
            
            var data = message.slice(4 + metaLen)
            
            const status = meta["status"];
            const projectId = meta["headers"]["Project-Id"]

            const res = ResponseMap.getResponse(meta["messageId"])

            if (!res.headersSent) {
                res.writeHeader(status, meta["headers"])
            }

            if (status==304) {
                res.status(304)
                res.end()
                return;
            }

            if (
                meta.isLast &&
                Object.values(meta.headers).some((v: any) => v.includes("text/html"))
            ) {

                const html = data.toString("utf8");

                const modified = html.replace(
                    /<\/head>/i,
                    `<head><script>window.__TUNNEL_PROJECT_ID__ = "${projectId}";</script>
                    <script src="/scripts/ws-proxy.js"></script>`
                );
                res.write(Buffer.from(modified));
            } else {
                res.write(data)
            }
            
            if (meta["isLast"]) {
                res.end()
            }
        })

        ws.on("close", () => {
            DevConnections.removeConnection(ws);
        })
    })
}

function addVmSession(ws: any, projId: any, role: any, clientId: any = null) {
    var x = vmSessions.get(projId);

    if (role === "agent") {
        x.set("agent", ws)
    } else {
        x.get("clients")[clientId] = ws
    }
}

export function iniVmWS() {
    console.log(`Running VM Service on Port: ${wsPort}`)

    vmWss.on("connection", async (ws, req) => {
        const role = req.headers["x-wing-role"];
        const rawUrl = req.url || '/';

        if (rawUrl === "/") {
            ws.close(1014, "Bad Request")
            return
        }

        const [, projectId, port, clientId, ...params] = rawUrl.split("/")
        
        if (!vmSessions.has(projectId)) {
            vmSessions.set(projectId, new Map([
                ["agent", null],
                ["clients", {}]
            ]))
            console.log(vmSessions)
        }

        addVmSession(ws, projectId, role, clientId)
        const session = vmSessions.get(projectId)

        ws.on("message", (message: any, isBinary: boolean) => {
            if (role === "agent") {
                const parsed = JSON.parse(message.toString('utf-8'))
                const data = parsed.isBinary 
                    ? Buffer.from(parsed.message, 'base64') 
                    : parsed.message
                session.get("clients")[parsed.clientId].send(data, { binary: parsed.isBinary })
            } else {
                session.get("agent").send(JSON.stringify({ 
                    port, 
                    clientId, 
                    params,
                    isBinary, 
                    message: isBinary ? message : message.toString('utf-8')
                }))
            }
        })
    })
    
}