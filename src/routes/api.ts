import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { randomBytes } from 'node:crypto';
import { responseSchema } from '../services/constraints.js';
import { forwardRequest, waitForResponse } from '../services/devMachineLogic.js';
import DevConnections from '../services/devConnections.js';
import ResolveRegister from '../services/resolveRegister.js';

const apiRoute: Router = Router();

function injectBaseTag(html: string, projectId: string) {
    const baseHref = `/api/project/${projectId}/`;
    const baseTag = `<base href="${baseHref}">`

    if (/<base\s/i.test(html)) {
        return html;
    }

    if (/<head[^>]*>/i.test(html)) {
        return html.replace(
            /<head([^>]*)>/i,
            `<head$1>${baseTag}`
        )
    }
    
    if (/html[^>]*>/i.test(html)) {
        return html.replace(
            /<html([^>]*)>/i,
            `<html$1><head>${baseTag}</head>`
        )
    }

    return `${baseTag}${html}`;
}

function rewriteRootPaths(html: string, projectId: string): string {
    const prefix = `/api/project/${projectId}`;

    return html
        .replace(
            /src=(["'])\/(?!\/)([^"']*)\1/g,
            `src=$1${prefix}/$2$1`
        )
        .replace(
            /href=(["'])\/(?!\/)([^"']*)\1/g,
            `href=$1${prefix}/$2$1`
        )
        .replace(
            /action=(["'])\/(?!\/)([^"']*)\1/g,
            `action=$1${prefix}/$2$1`
        );
}

function generateMid(): string {
    const mid = `${randomBytes(7).toString('hex')}`
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

    if (ResolveRegister.getResolve(mid)==null) {
        return mid
    }

    return generateMid();
}

// For root path connections 
apiRoute.get("/project/:name/{*path}", async(req: Request, res: Response) => {
    const { name, path } = req.params;

    // TODO: Add parameters

    const mid: string = generateMid();
    const ws = DevConnections.getConnection(name.toString());
    
    if (ws==null) {
        res.send(responseSchema(404, "Project instance not found", []));
    } else if (mid==null) {
        res.send(responseSchema(404, "message id not included", []));
    } else {
        mid;
        const message = {
            "messageId": mid,
            "method": "GET",
            "location": `/${(path && path.length > 0) ? (Array.isArray(path) ? path.join("/") : path) : ""}`
        };
        await forwardRequest(message, DevConnections.getConnection(name.toString()));
        waitForResponse(mid, ws)
        .then((result: any) => {
            // TODO: Implement sending binary site data
            Object.entries(result["headers"]).forEach(([key, value]) => {
                res.setHeader(key, value as string);
            })
            if (result["contentType"].includes("text/html")) {
                var respHtml = rewriteRootPaths(result["body"], name.toString())
                // respHtml = injectBaseTag(respHtml, name.toString());
                res.status(result["status"]).send(respHtml);
                return;
            }

            if (result["binary"]) {
                const buffer = Buffer.from(result["body"], "base64")
                res.status(result["status"]).send(`${buffer}`)
                return;
            }

            res.status(result["status"]).send(`${result["body"]}`);
        })
        // .catch((err) => res.status(500).send(err));
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