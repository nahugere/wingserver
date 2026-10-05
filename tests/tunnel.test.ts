import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import WebSocket from "ws";
import { getSharedServer, closeSharedServer, sleep } from "./setup.js";

describe("HTTP Tunneling", () => {
    let baseUrl: string;
    let wsUrl: string;
    let projectId: string;
    let secret: string;
    let devWs: WebSocket;

    beforeAll(async () => {
        const server = await getSharedServer();
        baseUrl = server.baseUrl;
        wsUrl = server.wsUrl;

        // Create a session
        const res = await request(baseUrl).post("/api/create");
        projectId = res.body.data.project_id;
        secret = res.body.data.secret;

        // Connect as dev machine
        devWs = new WebSocket(`${wsUrl}/ws/${projectId}`, {
            headers: { Authorization: `Bearer ${secret}` },
        });

        await new Promise<void>((resolve, reject) => {
            devWs.on("open", () => resolve());
            devWs.on("error", reject);
        });
    });

    afterAll(async () => {
        if (devWs && devWs.readyState === WebSocket.OPEN) {
            devWs.close(1000);
        }
        await closeSharedServer();
    });

    it("should return 404 when no dev machine is connected", async () => {
        // Create a new session without connecting a dev machine
        const res = await request(baseUrl).post("/api/create");
        const newProjectId = res.body.data.project_id;

        const tunnelRes = await request(baseUrl)
            .get(`/tunnel/${newProjectId}/some-path`)
            .expect(404);

        expect(tunnelRes.text).toContain("Project instance not found");
    });

    it("should forward HTTP request to dev machine via WebSocket", async () => {
        // Set up a message handler on the dev WebSocket
        const messagePromise = new Promise<any>((resolve) => {
            const handler = (data: any) => {
                const msg = JSON.parse(data.toString());
                if (msg.method === "GET" && msg.path === "/api/data") {
                    devWs.off("message", handler);
                    resolve(msg);
                }
            };
            devWs.on("message", handler);
        });

        // Send HTTP request through tunnel
        const tunnelRes = request(baseUrl)
            .get(`/tunnel/${projectId}/api/data`)
            .set("Accept", "application/json");

        // Wait for the message to arrive at dev machine
        const msg = await messagePromise;

        expect(msg).toHaveProperty("messageId");
        expect(msg).toHaveProperty("method", "GET");
        expect(msg).toHaveProperty("path", "/api/data");
        expect(msg).toHaveProperty("headers");
        expect(msg).toHaveProperty("query");

        // Send response back from dev machine
        const meta = JSON.stringify({
            messageId: msg.messageId,
            status: 200,
            headers: { "content-type": "application/json" },
            isLast: true,
        });

        const body = JSON.stringify({ success: true, data: "test" });
        const metaLen = Buffer.byteLength(meta);
        const payload = Buffer.alloc(4 + metaLen + Buffer.byteLength(body));
        payload.writeUInt32BE(metaLen, 0);
        payload.write(meta, 4);
        payload.write(body, 4 + metaLen);

        devWs.send(payload);

        const res = await tunnelRes;
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, data: "test" });
    });

    it("should handle POST requests with body", async () => {
        const messagePromise = new Promise<any>((resolve) => {
            const handler = (data: any) => {
                const msg = JSON.parse(data.toString());
                if (msg.method === "POST" && msg.path === "/api/submit") {
                    devWs.off("message", handler);
                    resolve(msg);
                }
            };
            devWs.on("message", handler);
        });

        const tunnelRes = request(baseUrl)
            .post(`/tunnel/${projectId}/api/submit`)
            .send({ name: "test", value: 42 });

        const msg = await messagePromise;

        expect(msg.method).toBe("POST");
        expect(msg.path).toBe("/api/submit");
        expect(msg.body).toEqual({ name: "test", value: 42 });

        // Send response
        const meta = JSON.stringify({
            messageId: msg.messageId,
            status: 201,
            headers: { "content-type": "application/json" },
            isLast: true,
        });
        const body = JSON.stringify({ created: true });
        const metaLen = Buffer.byteLength(meta);
        const payload = Buffer.alloc(4 + metaLen + Buffer.byteLength(body));
        payload.writeUInt32BE(metaLen, 0);
        payload.write(meta, 4);
        payload.write(body, 4 + metaLen);

        devWs.send(payload);

        const res = await tunnelRes;
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ created: true });
    });

    it("should set current_tunnel cookie on response", async () => {
        const messagePromise = new Promise<any>((resolve) => {
            const handler = (data: any) => {
                const msg = JSON.parse(data.toString());
                if (msg.path === "/page") {
                    devWs.off("message", handler);
                    resolve(msg);
                }
            };
            devWs.on("message", handler);
        });

        const tunnelRes = request(baseUrl)
            .get(`/tunnel/${projectId}/page`);

        const msg = await messagePromise;

        const meta = JSON.stringify({
            messageId: msg.messageId,
            status: 200,
            headers: { "content-type": "text/html" },
            isLast: true,
        });
        const body = "<html><body>Hello</body></html>";
        const metaLen = Buffer.byteLength(meta);
        const payload = Buffer.alloc(4 + metaLen + Buffer.byteLength(body));
        payload.writeUInt32BE(metaLen, 0);
        payload.write(meta, 4);
        payload.write(body, 4 + metaLen);

        devWs.send(payload);

        const res = await tunnelRes;
        expect(res.status).toBe(200);
        expect(res.headers["set-cookie"]?.some((c: string) => c.includes("current_tunnel"))).toBe(true);
    });
});

describe("Fallback Handler", () => {
    let baseUrl: string;
    let wsUrl: string;
    let projectId: string;
    let secret: string;
    let devWs: WebSocket;

    beforeAll(async () => {
        const server = await getSharedServer();
        baseUrl = server.baseUrl;
        wsUrl = server.wsUrl;

        const res = await request(baseUrl).post("/api/create");
        projectId = res.body.data.project_id;
        secret = res.body.data.secret;

        devWs = new WebSocket(`${wsUrl}/ws/${projectId}`, {
            headers: { Authorization: `Bearer ${secret}` },
        });

        await new Promise<void>((resolve, reject) => {
            devWs.on("open", () => resolve());
            devWs.on("error", reject);
        });
    });

    afterAll(async () => {
        if (devWs && devWs.readyState === WebSocket.OPEN) {
            devWs.close(1000);
        }
        await closeSharedServer();
    });

    it("should forward requests with current_tunnel cookie to fallback handler", async () => {
        const messagePromise = new Promise<any>((resolve) => {
            const handler = (data: any) => {
                const msg = JSON.parse(data.toString());
                if (msg.path === "/some-fallback-path") {
                    devWs.off("message", handler);
                    resolve(msg);
                }
            };
            devWs.on("message", handler);
        });

        const tunnelRes = request(baseUrl)
            .get("/some-fallback-path")
            .set("Cookie", `current_tunnel=${projectId}`);

        const msg = await messagePromise;

        expect(msg.path).toBe("/some-fallback-path");

        // Send response
        const meta = JSON.stringify({
            messageId: msg.messageId,
            status: 200,
            headers: { "content-type": "text/html" },
            isLast: true,
        });
        const body = "<html><body>Fallback</body></html>";
        const metaLen = Buffer.byteLength(meta);
        const payload = Buffer.alloc(4 + metaLen + Buffer.byteLength(body));
        payload.writeUInt32BE(metaLen, 0);
        payload.write(meta, 4);
        payload.write(body, 4 + metaLen);

        devWs.send(payload);

        const res = await tunnelRes;
        expect(res.status).toBe(200);
    });
});
