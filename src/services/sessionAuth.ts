import crypto from "crypto";

interface SessionAuth {
    secret: string;
    createdAt: number;
}

export const SESSIONS = new Map<string, SessionAuth>();
export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

export function pruneExpired(): void {
    const now = Date.now();
    for (const [projectId, session] of SESSIONS) {
        if (now - session.createdAt > SESSION_TTL_MS) {
            SESSIONS.delete(projectId);
        }
    }
}
export function authenticateSocket(projectId: string, authHeader: string | undefined): boolean {
    const session = SESSIONS.get(projectId);
    if (!session) return false;

    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
        SESSIONS.delete(projectId);
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
export default SessionAuth