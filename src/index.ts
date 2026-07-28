import http from 'http';
import { WebSocketServer } from 'ws';
import DevConnections from './services/devConnections.js';
import { initWS, wss, iniVmWS } from './routes/skt.js';

import cookieParser from 'cookie-parser';
import express, { Application, Request, Response } from 'express';
import apiRoute from './routes/api.js';
import cors from 'cors';
import morgan from 'morgan';
import { prisma } from './lib/prisma.js';
import { forwardRequest, generateMid } from './services/devMachineLogic.js';
import ResponseMap from './services/responseMap.js';
import path from 'path';

const port = process.env.PORT || 3000;

const app: Application = express();
const server = http.createServer(app);

initWS();
iniVmWS();

server.on("upgrade", async (req, socket, head) => {
    const url = req.url || "/";
    const projectId = url.split("?")[0].slice(1);

    // Project not provided in url
    if (!projectId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
    }

    // Project is already open
    // if (DevConnections.getConnection(projectId)!=null) {
    //     socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    //     socket.destroy();
    //     return;
    // }

    try {
        
        // TODO: Implement caching here
        const project = await prisma.project.findUnique({where: { project_id: projectId }});
        
        if (!project) {
            socket.write("HTTP/1.1 404 Project Not Found\r\n\r\n");
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            DevConnections.addConnection(projectId, ws);
            wss.emit("connection", ws, req);
        })
    } catch (err) {
        console.log(err);

        socket.write("HTTP/1.1 500 Server Error\r\n\r\n");
        socket.destroy();
        return;
    }

});

app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(morgan("tiny"));
app.use("/api", apiRoute);
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.raw({ type: "*/*" }));

app.get('/', (req: Request, res: Response) => {
    res.send('Welcome to the mainpage!');
});

app.use( async (req: Request, res: Response) => {
    try {
        const projectName = req.cookies['current_tunnel'];
        const path = req.path.toString().slice(1);
        const mid: string = generateMid();

        ResponseMap.addConnection(mid, res)
        await forwardRequest(projectName, mid, path, DevConnections.getConnection(projectName.toString()), req, res);

        res.on("close", () => {
            ResponseMap.removeResponses(mid);
        })
    } catch (e) {
        res.status(404).send("Page Not Found")
    }
})

server.listen(port, () => {
    console.log(`Server running on port: ${port}`)
})

export default server;