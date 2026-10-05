import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import WebSocket from "ws";
import { getSharedServer, closeSharedServer, sleep } from "./setup.js";

describe("Session Creation", () => {
    let baseUrl: string;

    beforeAll(async () => {
        const { baseUrl: url } = await getSharedServer();
        baseUrl = url;
    });

    afterAll(async () => {
        await closeSharedServer();
    });

    it("should create a new session with project_id and secret", async () => {
        const res = await request(baseUrl)
            .post("/api/create")
            .expect(200);

        expect(res.body).toHaveProperty("statusCode", 200);
        expect(res.body).toHaveProperty("data");
        expect(res.body.data).toHaveProperty("project_id");
        expect(res.body.data).toHaveProperty("secret");
        expect(typeof res.body.data.project_id).toBe("string");
        expect(typeof res.body.data.secret).toBe("string");
        expect(res.body.data.project_id.length).toBeGreaterThan(0);
        expect(res.body.data.secret.length).toBeGreaterThan(0);
    });

    it("should generate unique project IDs for each request", async () => {
        const res1 = await request(baseUrl).post("/api/create");
        const res2 = await request(baseUrl).post("/api/create");

        expect(res1.body.data.project_id).not.toBe(res2.body.data.project_id);
        expect(res1.body.data.secret).not.toBe(res2.body.data.secret);
    });
});

describe("Session Authentication", () => {
    let baseUrl: string;
    let wsUrl: string;
    let projectId: string;
    let secret: string;

    beforeAll(async () => {
        const server = await getSharedServer();
        baseUrl = server.baseUrl;
        wsUrl = server.wsUrl;

        // Create a session
        const res = await request(baseUrl).post("/api/create");
        projectId = res.body.data.project_id;
        secret = res.body.data.secret;
    });

    afterAll(async () => {
        await closeSharedServer();
    });

    it("should reject WebSocket connection without auth header", async () => {
        const ws = new WebSocket(`${wsUrl}/ws/${projectId}`);

        const result = await new Promise<{ code: number }>((resolve) => {
            const timer = setTimeout(() => {
                ws.terminate();
                resolve({ code: -1 });
            }, 3000);

            ws.on("close", (code) => {
                clearTimeout(timer);
                resolve({ code });
            });
            ws.on("error", () => {
                clearTimeout(timer);
            });
        });

        expect(result.code).not.toBe(1000);
    });

    it("should reject WebSocket connection with invalid token", async () => {
        const ws = new WebSocket(`${wsUrl}/ws/${projectId}`, {
            headers: { Authorization: "Bearer invalid-token" },
        });

        const result = await new Promise<{ code: number }>((resolve) => {
            const timer = setTimeout(() => {
                ws.terminate();
                resolve({ code: -1 });
            }, 3000);

            ws.on("close", (code) => {
                clearTimeout(timer);
                resolve({ code });
            });
            ws.on("error", () => {
                clearTimeout(timer);
            });
        });

        expect(result.code).not.toBe(1000);
    });

    it("should accept WebSocket connection with valid token", async () => {
        const ws = new WebSocket(`${wsUrl}/ws/${projectId}`, {
            headers: { Authorization: `Bearer ${secret}` },
        });

        const result = await new Promise<{ opened: boolean; code?: number }>((resolve) => {
            const timer = setTimeout(() => {
                ws.terminate();
                resolve({ opened: false });
            }, 5000);

            ws.on("open", () => {
                clearTimeout(timer);
                resolve({ opened: true });
            });

            ws.on("close", (code) => {
                clearTimeout(timer);
                resolve({ opened: false, code });
            });

            ws.on("error", () => {
                clearTimeout(timer);
                resolve({ opened: false });
            });
        });

        expect(result.opened).toBe(true);
        ws.close(1000);
    });

    it("should reject second connection for same project", async () => {
        // First connection
        const ws1 = new WebSocket(`${wsUrl}/ws/${projectId}`, {
            headers: { Authorization: `Bearer ${secret}` },
        });

        await new Promise<void>((resolve) => {
            ws1.on("open", () => resolve());
        });

        // Second connection should be rejected
        const ws2 = new WebSocket(`${wsUrl}/ws/${projectId}`, {
            headers: { Authorization: `Bearer ${secret}` },
        });

        const result = await new Promise<{ code: number }>((resolve) => {
            const timer = setTimeout(() => {
                ws2.terminate();
                resolve({ code: -1 });
            }, 3000);

            ws2.on("close", (code) => {
                clearTimeout(timer);
                resolve({ code });
            });
            ws2.on("error", () => {
                clearTimeout(timer);
            });
        });

        expect(result.code).not.toBe(1000);
        ws1.close(1000);
    });
});
