import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import WebSocket from "ws";
import { getSharedServer, closeSharedServer, sleep } from "./setup.js";

describe("VM WebSocket Proxy", () => {
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

        // Connect as dev machine (agent)
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

    it("should reject VM WebSocket connection with invalid URL", async () => {
        const ws = new WebSocket(`${wsUrl}/vmws/`);

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

    it("should connect as agent role", async () => {
        const agentWs = new WebSocket(
            `${wsUrl}/vmws/${projectId}/8080/client1/some/path`,
            { headers: { "x-wing-role": "agent" } }
        );

        const result = await new Promise<{ opened: boolean }>((resolve) => {
            const timer = setTimeout(() => {
                agentWs.terminate();
                resolve({ opened: false });
            }, 3000);

            agentWs.on("open", () => {
                clearTimeout(timer);
                resolve({ opened: true });
            });

            agentWs.on("error", () => {
                clearTimeout(timer);
                resolve({ opened: false });
            });
        });

        expect(result.opened).toBe(true);
        agentWs.close(1000);
    });

    it("should connect as client role", async () => {
        const clientWs = new WebSocket(
            `${wsUrl}/vmws/${projectId}/8080/client1/some/path`,
            { headers: { "x-wing-role": "client" } }
        );

        const result = await new Promise<{ opened: boolean }>((resolve) => {
            const timer = setTimeout(() => {
                clientWs.terminate();
                resolve({ opened: false });
            }, 3000);

            clientWs.on("open", () => {
                clearTimeout(timer);
                resolve({ opened: true });
            });

            clientWs.on("error", () => {
                clearTimeout(timer);
                resolve({ opened: false });
            });
        });

        expect(result.opened).toBe(true);
        clientWs.close(1000);
    });

    it("should forward messages from client to agent", async () => {
        const agentWs = new WebSocket(
            `${wsUrl}/vmws/${projectId}/8080/client1/path`,
            { headers: { "x-wing-role": "agent" } }
        );

        await new Promise<void>((resolve) => agentWs.on("open", () => resolve()));

        const clientWs = new WebSocket(
            `${wsUrl}/vmws/${projectId}/8080/client1/path`,
            { headers: { "x-wing-role": "client" } }
        );

        await new Promise<void>((resolve) => clientWs.on("open", () => resolve()));

        // Listen for message on agent side
        const agentMessagePromise = new Promise<any>((resolve) => {
            agentWs.on("message", (data) => {
                resolve(JSON.parse(data.toString()));
            });
        });

        // Send message from client
        clientWs.send(JSON.stringify({ type: "test", data: "hello" }));

        const msg = await agentMessagePromise;
        expect(msg).toHaveProperty("port", "8080");
        expect(msg).toHaveProperty("clientId", "client1");
        expect(msg).toHaveProperty("sendMessage", true);

        agentWs.close(1000);
        clientWs.close(1000);
    });

    it("should forward messages from agent to specific client", async () => {
        const agentWs = new WebSocket(
            `${wsUrl}/vmws/${projectId}/8080/client1/path`,
            { headers: { "x-wing-role": "agent" } }
        );

        await new Promise<void>((resolve) => agentWs.on("open", () => resolve()));

        const clientWs = new WebSocket(
            `${wsUrl}/vmws/${projectId}/8080/client1/path`,
            { headers: { "x-wing-role": "client" } }
        );

        await new Promise<void>((resolve) => clientWs.on("open", () => resolve()));

        // Listen for message on client side
        const clientMessagePromise = new Promise<any>((resolve) => {
            clientWs.on("message", (data) => {
                resolve(data.toString());
            });
        });

        // Send message from agent
        agentWs.send(JSON.stringify({
            clientId: "client1",
            isBinary: false,
            message: "response from agent",
        }));

        const msg = await clientMessagePromise;
        expect(msg).toBe("response from agent");

        agentWs.close(1000);
        clientWs.close(1000);
    });

    it("should handle binary messages", async () => {
        const agentWs = new WebSocket(
            `${wsUrl}/vmws/${projectId}/8080/client1/path`,
            { headers: { "x-wing-role": "agent" } }
        );

        await new Promise<void>((resolve) => agentWs.on("open", () => resolve()));

        const clientWs = new WebSocket(
            `${wsUrl}/vmws/${projectId}/8080/client1/path`,
            { headers: { "x-wing-role": "client" } }
        );

        await new Promise<void>((resolve) => clientWs.on("open", () => resolve()));

        // Listen for binary message on agent side
        const agentMessagePromise = new Promise<{ data: Buffer; binary: boolean }>((resolve) => {
            agentWs.on("message", (data, binary) => {
                resolve({ data: Buffer.from(data as any), binary });
            });
        });

        // Send binary message from client
        const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
        clientWs.send(binaryData);

        const msg = await agentMessagePromise;
        expect(msg.binary).toBe(true);

        agentWs.close(1000);
        clientWs.close(1000);
    });

    it("should clean up client on disconnect", async () => {
        const agentWs = new WebSocket(
            `${wsUrl}/vmws/${projectId}/8080/client1/path`,
            { headers: { "x-wing-role": "agent" } }
        );

        await new Promise<void>((resolve) => agentWs.on("open", () => resolve()));

        const clientWs = new WebSocket(
            `${wsUrl}/vmws/${projectId}/8080/client1/path`,
            { headers: { "x-wing-role": "client" } }
        );

        await new Promise<void>((resolve) => clientWs.on("open", () => resolve()));

        // Disconnect client
        clientWs.close(1000);
        await sleep(100);

        // Connect a new client and send a message
        const newClientWs = new WebSocket(
            `${wsUrl}/vmws/${projectId}/8080/client1/path`,
            { headers: { "x-wing-role": "client" } }
        );

        await new Promise<void>((resolve) => newClientWs.on("open", () => resolve()));

        const agentMessagePromise = new Promise<any>((resolve) => {
            agentWs.on("message", (data) => {
                resolve(JSON.parse(data.toString()));
            });
        });

        newClientWs.send(JSON.stringify({ type: "test" }));

        const msg = await agentMessagePromise;
        expect(msg).toHaveProperty("clientId", "client1");

        agentWs.close(1000);
        newClientWs.close(1000);
    });
});
