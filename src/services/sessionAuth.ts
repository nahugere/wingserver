import crypto from "crypto";
import { getSession, deleteSession, getAllSessions } from '../redis.js';

export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

export async function pruneExpired(): Promise<void> {
    const now = Date.now();
    const sessions = await getAllSessions();
    for (const [projectId, session] of Object.entries(sessions)) {
        if (now - session.createdAt > SESSION_TTL_MS) {
            await deleteSession(projectId);
        }
    }
}

export async function authenticateSocket(projectId: string, authHeader: string | undefined): Promise<boolean> {
    const session = await getSession(projectId);

    if (!session) return false;

    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
        await deleteSession(projectId);
        return false;
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) return false;

    const provided = authHeader.slice("Bearer ".length);
    const providedBuf = Buffer.from(provided);
    const secretBuf = Buffer.from(session.secret);

    if (providedBuf.length !== secretBuf.length) return false;

    return crypto.timingSafeEqual(providedBuf, secretBuf);
}

export function generateProjectId(): string {
    return crypto.randomBytes(6).toString("base64url");
}

export function generateSecret(): string {
    return crypto.randomBytes(32).toString("base64url");
}
