import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["./tests/setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["src/**/*.ts"],
            exclude: ["src/index.ts", "src/lib/**"],
        },
        testTimeout: 10000,
        hookTimeout: 10000,
    },
    resolve: {
        alias: {
            "@": "/Users/nahugere/Documents/Projects/wing/wingserver/src",
        },
    },
});
