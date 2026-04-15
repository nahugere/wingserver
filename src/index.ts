import http from 'http';
import { WebSocketServer } from 'ws';
import DevConnections from './services/devConnections.js';
import { initWS, wss } from './routes/skt.js';

import express, { Application, Request, Response } from 'express';
import apiRoute from './routes/api.js';
import cors from 'cors';
import morgan from 'morgan';
import { prisma } from './lib/prisma.js';

const port = process.env.PORT || 3000;

const app: Application = express();
const server = http.createServer(app);

initWS();

server.on("upgrade", async (req, socket, head) => {
    const url = req.url || "/";
    const projectId = url.split("?")[0].slice(1);
    
    if (!projectId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
    }

    try {
        
        const project = await prisma.project.findUnique({where: { project_id: projectId }});
        
        if (!project) {
            console.log("satk");

            socket.write("HTTP/1.1 404 Project Not Found\r\n\r\n");
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            DevConnections.addConnection(projectId, ws);
            console.log(projectId, DevConnections);
            wss.emit("connection", ws, req);
        })
    } catch (err) {
        console.log("here swaaa");

        socket.write("HTTP/1.1 500 Server Error\r\n\r\n");
        socket.destroy();
        return;
    }

});

app.use(express.json())
app.use(cors())
app.use(morgan("tiny"))
app.use("/api", apiRoute)

app.get('/', (req: Request, res: Response) => {
    res.send('Welcome to the mainpage!');
});

server.listen(port, () => {
    console.log(`Server running on port: ${port}`)
})

export default server;