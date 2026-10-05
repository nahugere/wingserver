import http from "http";
import type { Express } from "express";

export interface TestServer {
    server: http.Server;
    app: Express;
    port: number;
    baseUrl: string;
    wsUrl: string;
}

export async function createTestServer(app: Express): Promise<TestServer> {
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.listen(0, () => {
            const { port } = server.address() as AddressInfo;
            resolve({
                server,
                app,
                port,
                baseUrl: `http://localhost:${port}`,
                wsUrl: `ws://localhost:${port}`,
            });
        });
        server.on("error", reject);
    });
}

export async function closeTestServer(testServer: TestServer): Promise<void> {
    return new Promise((resolve) => {
        testServer.server.close(() => resolve());
    });
}

export function waitForEvent(emitter: any, event: string, timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for event: ${event}`));
        }, timeout);
        emitter.once(event, () => {
            clearTimeout(timer);
            resolve();
        });
    });
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
