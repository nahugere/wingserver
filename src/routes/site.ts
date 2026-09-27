import { Router } from "express";
import express, { Application, Request, Response } from 'express';
import { forwardRequest, generateMid } from "../services/devMachineLogic.js";
import DevConnections from "../services/devConnections.js";
import ResponseMap from "../services/responseMap.js";
import { responseSchema } from "../services/constraints.js";

const siteRoute: Router = Router();

siteRoute.all("/tunnel/:name/{*path}", async(req: Request, res: Response) => {
    const { name, path } = req.params;
    console.log("hello")
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

siteRoute.get("/", (req: Request, res: Response) => {
    res.render("index")
})

export default siteRoute;