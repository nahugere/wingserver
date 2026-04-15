// TODO: Implement Redis Pub/Sub for better communication with workers
import { WebSocketServer } from "ws";
import DevConnections from "../services/devConnections.js";
import { prisma } from '../lib/prisma.js';

export const wss = new WebSocketServer({ noServer: true });
export function initWS() {
    wss.on("connection", async (ws, req) => {
        console.log("Websocket logic goes here");
    })
}