import express, { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const apiRoute: Router = Router();

apiRoute.get("/projects/:id", async(req: Request, res: Response) => {
    // const projects = prisma.project.findMany();
    const { id } = req.params;
    res.send(id);
})

apiRoute.post("/create", async(req: Request, res: Response) => {

})

export default apiRoute;