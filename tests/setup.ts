import { vi, beforeAll, afterAll, beforeEach } from "vitest";
import RedisMock from "ioredis-mock";
import http from "http";
import type { Express } from "express";

// Clear DEBUG so the server doesn't auto-listen
delete process.env.DEBUG;

// Mock Redis before any imports
const mockRedis = new RedisMock();

vi.mock("../src/redis", () => ({
    redis: mockRedis,
    redisVmSession: "wing:sessions:001",
    storeSession: async (projectId: string, session: any) => {
        await mockRedis.hset("wing:sessions:001", projectId, JSON.stringify(session));
        return true;
    },
    getSession: async (projectId: string) => {
        const data = await mockRedis.hget("wing:sessions:001", projectId);
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    },
    deleteSession: async (projectId: string) => {
        const removed = await mockRedis.hdel("wing:sessions:001", projectId);
        return removed === 1;
    },
    getAllSessions: async () => {
        const raw = await mockRedis.hgetall("wing:sessions:001");
        const sessions: Record<string, any> = {};
        for (const [key, value] of Object.entries(raw)) {
            try {
                sessions[key] = JSON.parse(value as string);
            } catch {
                continue;
            }
        }
        return sessions;
    },
}));

// Mock Prisma
vi.mock("../src/lib/prisma", () => ({
    prisma: {
        project: {
            create: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

// Set test environment variables
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";

// Shared test server
let sharedServer: http.Server;
let sharedPort: number;

export async function getSharedServer(): Promise<{ server: http.Server; port: number; baseUrl: string; wsUrl: string }> {
    if (sharedServer && sharedPort) {
        return {
            server: sharedServer,
            port: sharedPort,
            baseUrl: `http://localhost:${sharedPort}`,
            wsUrl: `ws://localhost:${sharedPort}`,
        };
    }

    // Import the app - this sets up all routes and middleware
    const { default: server } = await import("../src/index");

    // Start listening on an ephemeral port
    await new Promise<void>((resolve, reject) => {
        server.listen(0, () => resolve());
        server.on("error", reject);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("Failed to get server address");
    }

    sharedServer = server;
    sharedPort = address.port;

    return {
        server: sharedServer,
        port: sharedPort,
        baseUrl: `http://localhost:${sharedPort}`,
        wsUrl: `ws://localhost:${sharedPort}`,
    };
}

export async function closeSharedServer(): Promise<void> {
    if (sharedServer) {
        await new Promise<void>((resolve) => {
            sharedServer.close(() => resolve());
        });
        sharedServer = undefined as any;
        sharedPort = 0;
    }
}

beforeEach(async () => {
    // Clear Redis mock before each test
    await mockRedis.flushall();
});
