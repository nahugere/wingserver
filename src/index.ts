import http from 'http';
import { WebSocketServer } from 'ws';
import DevConnections from './services/devConnections.js';
import { initWS, iniVmWS, wsRoutes } from './routes/skt.js';
import { authenticateSocket } from './services/sessionAuth.js';
import cookieParser from 'cookie-parser';
import express, { Application, Request, Response } from 'express';
import apiRoute from './routes/api.js';
import cors from 'cors';
import morgan from 'morgan';
import { prisma } from './lib/prisma.js';
import { forwardRequest, generateMid } from './services/devMachineLogic.js';
import ResponseMap from './services/responseMap.js';
import path from 'path';
import siteRoute from './routes/site.js';

const port = process.env.PORT || 4000;

const app: Application = express();
const server = http.createServer(app);

initWS();
iniVmWS();

server.on("upgrade", async (req, socket, head) => {
    const url = req.url || "/";
    const params = url.split("/").slice(1)
    const route = params[0]
    
    // Route doesn't exist or improper url
    if (!route || params.length<2) {
        socket.destroy();
        return;
    }

    const projectId = params[1].split("?")[0].slice(0);
    const authHeader = req.headers["authorization"];

    // Project not provided in url
    if (!projectId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
    }

    switch (route) {
        case "ws":
            // Project is already open
            if (DevConnections.getConnection(projectId)!=null) {
                socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
                socket.destroy();
                return;
            }
        
            // Authentication fail
            const authSoc = await authenticateSocket(projectId, authHeader)
            if (!authSoc) {
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                socket.destroy();
                return;
            }

            break;
        default:
            break;
    }


    try {
        wsRoutes[route].handleUpgrade(req, socket, head, (ws) => {
            if(route=="ws") DevConnections.addConnection(projectId, ws);
            wsRoutes[route].emit("connection", ws, req);
        })
    } catch (err) {
        console.log(err);

        socket.write("HTTP/1.1 500 Server Error\r\n\r\n");
        socket.destroy();
        return;
    }

});

app.use(express.raw({ type: "*/*" }));
app.use(cors());
app.use(cookieParser());
app.use(morgan("tiny"));
app.use("/api", apiRoute);
app.use("/", siteRoute);
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.raw({ type: "*/*" }));

app.use( async (req: Request, res: Response) => {
    const projectName = req.cookies['current_tunnel'];
    const path = req.path.toString().slice(1);
    const mid: string = generateMid();
    
    try {

        if (path=="manifest.json") {
            console.log("heree")
        }
        
        ResponseMap.addConnection(mid, res)
        await forwardRequest(projectName, mid, path, DevConnections.getConnection(projectName.toString()), req, res);

        res.on("close", () => {
            ResponseMap.removeResponses(mid);
        })
    } catch (e) {
        res.status(404).send("Page Not Found")
    } finally {
        res.on("close", () => {
            ResponseMap.removeResponses(mid)
        })
    }
})

if (process.env.DEBUG) {
    server.listen(port, () => {
        console.log(`Server running on port: ${port}`)
    })
}

export default server;