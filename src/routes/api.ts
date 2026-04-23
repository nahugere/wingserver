import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { randomBytes } from 'node:crypto';
import { responseSchema } from '../services/constraints.js';
import { forwardRequest, waitForResponse } from '../services/devMachineLogic.js';
import DevConnections from '../services/devConnections.js';

const apiRoute: Router = Router();

apiRoute.get("/project/:name", async(req: Request, res: Response) => {
    const { name } = req.params;
    const { mid } = req.query;
    const ws = DevConnections.getConnection(name.toString());
    if (ws==null) {
        res.send(responseSchema(404, "Project instance not found", []));
    } else if (mid==null) {
        res.send(responseSchema(404, "message id not included", []));
    } else {
        mid.toString();
        const message: Map<string, any> = new Map<string, any>();
        message.set(mid?.toString(), "<h1>hello</h1>");
        console.log(message)
        await forwardRequest(message, DevConnections.getConnection(name.toString()));
        waitForResponse(mid.toString(), ws)
        .then((result: any) => {
            // TODO: Implement sending binary site data
            result.split
            res.send(`${result}`);
        })
        .catch((err) => res.send("error bruv"));
    }
})

// TODO: Implement the ability to fetch static or media files from the pipeline

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