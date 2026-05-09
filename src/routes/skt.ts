// TODO: Implement Redis Pub/Sub for better communication with workers
import { WebSocketServer } from "ws";
import ResponseMap from "../services/responseMap.js";
import DevConnections from "../services/devConnections.js";

export const wss = new WebSocketServer({ noServer: true });
export function initWS() {
    wss.on("connection", async (ws, req) => {
        console.log("Client connected");

        // TODO: Implement logic to remove unwanted register and devconnection instances on disconnect
        ws.on("message", (message: any) => {
            const metaLen = message.readUInt32BE(0)
            
            const metaBuffer = message.slice(4, 4 + metaLen);
            const meta = JSON.parse(metaBuffer.toString('utf-8'));
            
            const data = message.slice(4 + metaLen)
            
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

            res.write(data)
            
            if (meta["isLast"]) {
                res.end()
            }
            // res.on("close", ()=>{
            //     ResponseMap.removeResponses(meta["messageId"])
            // })
        })

        ws.on("close", () => {
            // TODO: Remove connection here
            DevConnections.removeConnection(ws);
        })
    })
}