import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { randomBytes } from 'node:crypto';
import { responseSchema } from '../services/constraints.js';
import { forwardRequest, generateMid } from '../services/devMachineLogic.js';
import DevConnections from '../services/devConnections.js';
import ResponseMap from '../services/responseMap.js';

const apiRoute: Router = Router();

apiRoute.all("/project/:name/{*path}", async(req: Request, res: Response) => {
    const { name, path } = req.params;
    const mid: string = generateMid();
    const ws = DevConnections.getConnection(name.toString());
    console.error(ResponseMap.getAllResponses())
    if (ws==null) {
        res.send(responseSchema(404, "Project instance not found", []));
    } else {
        ResponseMap.addConnection(mid, res)
        await forwardRequest(name, mid, path, ws, req, res);
        res.on("close", () => {
            ResponseMap.removeResponses(mid);
        })
    }
})

// TODO: Implement forwarding for other http protocols

apiRoute.get("/get/:id", async(req: Request, res: Response) => {
    const { id } = req.params;
    const project = await prisma.project.findUnique({where: {project_id: id.toString()}});
    res.send(responseSchema(200, "Success", {"project_id": project!["project_id"], "project_name": project!["project_name"]}));
})

function generateName(name: string): string {
    return `${name} ${randomBytes(5).toString('hex')}`
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
}

async function isUnique(id: string) {
    const project = await prisma.project.findUnique({
        where: {
            project_id: id
        },
    });
    return project;
}

apiRoute.post("/create", async(req: Request, res: Response) => {
    const { name } = req.body; 
    var n = "";
    
    while(true) {
        n = generateName(name);
        if (isUnique(n)!=null) {
            break;
        }
    }

    const newProject = await prisma.project.create({
        data: {
            project_name: name,
            project_id: n
        }
    })

    if (newProject) {
        res.send(responseSchema(200, "Success", {"project_id": n}));
    } else {
        res.send(responseSchema(500, "Error"));
    }
})

export default apiRoute;