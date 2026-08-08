import { promises as fs } from "node:fs";
import path from "node:path";
import { build, version as esbuildVersion } from "esbuild";
import { generatePrecache, projectRoot } from "./generate-precache.mjs";

const checkOnly = process.argv.includes("--check");
const sourcePath = path.join(projectRoot, "assets", "js", "pdf-merger.mjs");
const bundlePath = path.join(projectRoot, "assets", "js", "pdf-merger.js");
const requiredEsbuildVersion = "0.28.1";

async function createPdfBundle() {
    const result = await build({
        entryPoints: [sourcePath],
        bundle: true,
        charset: "ascii",
        format: "iife",
        legalComments: "none",
        logLevel: "silent",
        minify: true,
        platform: "browser",
        write: false
    });
    if (result.outputFiles.length !== 1) {
        throw new Error("Expected esbuild to produce exactly one PDF bundle.");
    }
    // pdf-lib emits one template literal whose significant space sits directly
    // before a newline. Escape that space without changing the runtime string so
    // generated output also remains clean under `git diff --check`.
    return Buffer.from(
        result.outputFiles[0].text.replaceAll("` \n`", "`\\x20\n`"),
        "utf8"
    );
}

async function buildProject() {
    if (esbuildVersion !== requiredEsbuildVersion) {
        throw new Error("Expected esbuild " + requiredEsbuildVersion + ", found " + esbuildVersion + ".");
    }
    const expectedBundle = await createPdfBundle();
    if (checkOnly) {
        let actualBundle;
        try {
            actualBundle = await fs.readFile(bundlePath);
        } catch (error) {
            if (error && error.code === "ENOENT") {
                throw new Error("assets/js/pdf-merger.js is missing. Run npm run build.");
            }
            throw error;
        }
        const normalizedActualBundle = Buffer.from(
            actualBundle.toString("utf8").replace(/\r\n/g, "\n"),
            "utf8"
        );
        if (!normalizedActualBundle.equals(expectedBundle)) {
            throw new Error("assets/js/pdf-merger.js is stale. Run npm run build.");
        }
    } else {
        await fs.writeFile(bundlePath, expectedBundle);
    }

    await generatePrecache({ check: checkOnly });
    console.log(checkOnly ? "Build outputs are current." : "Build outputs updated.");
}

buildProject().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
