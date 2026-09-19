import { Router } from "express";
import express, { Application, Request, Response } from 'express';

const siteRoute: Router = Router();

siteRoute.get("/", (req: Request, res: Response) => {
    res.render("index")
})

export default siteRoute;