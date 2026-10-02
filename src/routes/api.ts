import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { randomBytes } from 'node:crypto';
import { responseSchema } from '../services/constraints.js';
import { pruneExpired, generateProjectId, generateSecret } from '../services/sessionAuth.js';
import { storeSession } from '../redis.js';

const apiRoute: Router = Router();

apiRoute.post("/create", async(req: Request, res: Response) => {
    await pruneExpired();

    const projectId = generateProjectId();
    const secret = generateSecret();

    const proc = await storeSession(projectId, { secret, createdAt: Date.now() });

    if (proc) res.json({
        statusCode: 200,
        data: { project_id: projectId, secret },
    });
    else res.json({
        statusCode: 500,
        data: { message: "error please try again later" }
    })
})

export default apiRoute;