import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { randomBytes } from 'node:crypto';
import { responseSchema } from '../services/constraints.js';
import { pruneExpired, generateProjectId, generateSecret, SESSIONS } from '../services/sessionAuth.js';

const apiRoute: Router = Router();

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

// apiRoute.post("/create", async(req: Request, res: Response) => {
//     const { name } = req.body; 
//     var n = "";
    
//     while(true) {
//         n = generateName(name);
//         if (await isUnique(n)!=null) {
//             break;
//         }
//     }

//     const newProject = await prisma.project.create({
//         data: {
//             project_name: name,
//             project_id: n
//         }
//     })

//     if (newProject) {
//         res.send(responseSchema(200, "Success", {"project_id": n}));
//     } else {
//         res.send(responseSchema(500, "Error"));
//     }
// })

apiRoute.post("/create", async(req: Request, res: Response) => {
    pruneExpired();

    const projectId = generateProjectId();
    const secret = generateSecret();

    SESSIONS.set(projectId, { secret, createdAt: Date.now() });

    res.json({
        statusCode: 200,
        data: { project_id: projectId, secret },
    });
})

export default apiRoute;