import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { getSharedServer, closeSharedServer } from "./setup.js";

describe("Landing Page", () => {
    let baseUrl: string;

    beforeAll(async () => {
        const { baseUrl: url } = await getSharedServer();
        baseUrl = url;
    });

    afterAll(async () => {
        await closeSharedServer();
    });

    it("should render the landing page", async () => {
        const res = await request(baseUrl)
            .get("/")
            .expect(200);

        expect(res.text).toContain("<html");
        expect(res.text).toContain("</html>");
    });

    it("should serve static assets", async () => {
        const res = await request(baseUrl)
            .get("/styles/style.css")
            .expect(200);

        expect(res.text).toContain("/*");
    });

    it("should serve ws-proxy.js", async () => {
        const res = await request(baseUrl)
            .get("/scripts/ws-proxy.js")
            .expect(200);

        expect(res.text).toContain("WebSocket");
    });
});
