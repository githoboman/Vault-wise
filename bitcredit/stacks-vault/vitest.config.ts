import { defineConfig } from "vitest/config";
import { vitestSetupFilePath } from "@stacks/clarinet-sdk/vitest";

export default defineConfig({
    test: {
        environment: "clarinet",
        setupFiles: [vitestSetupFilePath],
        poolOptions: {
            threads: { singleThread: true },
        },
        environmentOptions: {
            clarinet: {
                manifestPath: "./Clarinet.toml",
                coverageFilename: "lcov.info",
                costsFilename: "costs-reports.json",
                coverage: false,
                costs: false,
                initBeforeEach: true,
            },
        },
    },
});
