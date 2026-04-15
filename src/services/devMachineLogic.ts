import DevConnections from "../services/devConnections.js";
import { WebSocketServer } from "ws";

export async function forwardRequest(message: string, ws: WebSocket) {
    ws.send(message);
}