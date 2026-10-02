import { Redis } from "ioredis";

if (!process.env.REDIS_URL) {
    throw new Error("No Redis url provided")
}

export const redis = new Redis(process.env.REDIS_URL);

export const redisVmSession = "wing:sessions:001"

export interface SessionData {
    secret: string;
    createdAt: number;
}

export async function storeSession(projectId: string, session: SessionData): Promise<boolean> {
    try {
        await redis.hset(redisVmSession, projectId, JSON.stringify(session));
        return true;
    } catch {
        return false;
    }
}

export async function getSession(projectId: string): Promise<SessionData | null> {
    const data = await redis.hget(redisVmSession, projectId);
    if (!data) return null;
    try {
        return JSON.parse(data) as SessionData;
    } catch {
        return null;
    }
}

export async function deleteSession(projectId: string): Promise<boolean> {
    const removed = await redis.hdel(redisVmSession, projectId);
    return removed === 1;
}

export async function getAllSessions(): Promise<Record<string, SessionData>> {
    const raw = await redis.hgetall(redisVmSession);
    const sessions: Record<string, SessionData> = {};
    for (const [projectId, value] of Object.entries(raw)) {
        try {
            sessions[projectId] = JSON.parse(value) as SessionData;
        } catch {
            continue
        }
    }
    return sessions;
}
