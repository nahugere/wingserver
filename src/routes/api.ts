import express, { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const apiRoute: Router = Router();

apiRoute.get("/", async(req: Request, res: Response) => {
    const projects = prisma.project.findMany();
    res.send(projects);
})

// apiRoute.post("/create")

export default apiRoute;