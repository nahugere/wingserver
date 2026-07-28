// TODO: Implement Redis Pub/Sub for better communication with workers
import { WebSocketServer } from "ws";
import ResponseMap from "../services/responseMap.js";
import DevConnections from "../services/devConnections.js";

const wsPort = 5432;

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

                console.log(meta.headers)
                const html = data.toString("utf8");

                const modified = html.replace(
                    /<\/body>/i,
                    `<script src="/scripts/ws-proxy.js"></script></body>`
                );
                res.write(Buffer.from(modified));
            } else {
                console.log(res.headersSent);
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

export function iniVmWS() {
    console.log(`Running VM Service on Port: ${wsPort}`)
    vmWss.on("connection", async(ws, req) => {
        
        const rawUrl = req.url || '/';
        DevConnections.addConnection(rawUrl, ws)
        console.log("VM Service connected")

        ws.on("message", (message: any) => {
            
        })
    })
}