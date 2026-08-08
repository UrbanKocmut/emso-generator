import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(scriptDirectory, "..");
export const outputPath = path.join(projectRoot, "precache-manifest.js");

const requiredRootFiles = [
    "index.html",
    "manifest.webmanifest",
    "zasebnost.html"
];
const runtimeDirectories = ["assets", "fonts", "sprites"];
const hashAlgorithm = "sha256";
const textExtensions = new Set([
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".svg",
    ".txt",
    ".webmanifest"
]);

function comparePaths(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}

function toPosixPath(value) {
    return value.split(path.sep).join("/");
}

function digest(value) {
    return createHash(hashAlgorithm).update(value).digest("hex");
}

export function canonicalRuntimeContent(relativePath, contents) {
    const basename = path.posix.basename(toPosixPath(relativePath));
    const isText = textExtensions.has(path.posix.extname(basename).toLowerCase())
        || /^LICENSE(?:_|$)/i.test(basename)
        || /^README(?:\.|$)/i.test(basename);
    if (!isText) {
        return contents;
    }
    return Buffer.from(contents.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

async function pathDetails(filePath) {
    try {
        return await fs.stat(filePath);
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
}

async function collectDirectoryFiles(relativeDirectory, output) {
    const absoluteDirectory = path.join(projectRoot, relativeDirectory);
    const details = await pathDetails(absoluteDirectory);
    if (!details) {
        return;
    }
    if (!details.isDirectory()) {
        throw new Error(relativeDirectory + " must be a directory.");
    }

    const children = await fs.readdir(absoluteDirectory, { withFileTypes: true });
    children.sort((left, right) => comparePaths(left.name, right.name));
    for (const child of children) {
        const relativePath = path.join(relativeDirectory, child.name);
        if (child.isDirectory()) {
            await collectDirectoryFiles(relativePath, output);
        } else if (child.isFile()) {
            output.add(toPosixPath(relativePath));
        } else {
            throw new Error("Unsupported runtime path: " + toPosixPath(relativePath));
        }
    }
}

function localManifestAsset(source) {
    if (typeof source !== "string" || source.length === 0) {
        throw new Error("Every manifest icon and screenshot must have a local src.");
    }

    let decoded;
    try {
        decoded = decodeURIComponent(source.split(/[?#]/, 1)[0]);
    } catch {
        throw new Error("Invalid manifest asset URL: " + source);
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(decoded) || decoded.startsWith("//")) {
        throw new Error("Manifest assets must be local: " + source);
    }

    const relativePath = decoded.replace(/^\.\//, "").replace(/^\/+/, "");
    const absolutePath = path.resolve(projectRoot, relativePath);
    const relativeToRoot = path.relative(projectRoot, absolutePath);
    if (relativeToRoot.startsWith(".." + path.sep) || relativeToRoot === ".." || path.isAbsolute(relativeToRoot)) {
        throw new Error("Manifest asset is outside the project: " + source);
    }
    return toPosixPath(relativeToRoot);
}

async function collectManifestAssets(output) {
    const manifestPath = path.join(projectRoot, "manifest.webmanifest");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const referencedAssets = [
        ...(Array.isArray(manifest.icons) ? manifest.icons : []),
        ...(Array.isArray(manifest.screenshots) ? manifest.screenshots : [])
    ];
    for (const asset of referencedAssets) {
        const relativePath = localManifestAsset(asset && asset.src);
        const details = await pathDetails(path.join(projectRoot, relativePath));
        if (!details || !details.isFile()) {
            throw new Error("Manifest asset does not exist: " + relativePath);
        }
        output.add(relativePath);
    }
}

export async function collectRuntimeFiles() {
    const files = new Set();
    for (const relativePath of requiredRootFiles) {
        const details = await pathDetails(path.join(projectRoot, relativePath));
        if (!details || !details.isFile()) {
            throw new Error("Required runtime file does not exist: " + relativePath);
        }
        files.add(relativePath);
    }
    for (const relativeDirectory of runtimeDirectories) {
        await collectDirectoryFiles(relativeDirectory, files);
    }
    await collectManifestAssets(files);
    return [...files].sort(comparePaths);
}

export async function createPrecacheData() {
    const runtimeFiles = await collectRuntimeFiles();
    const entries = [];
    for (const relativePath of runtimeFiles) {
        const contents = canonicalRuntimeContent(
            relativePath,
            await fs.readFile(path.join(projectRoot, relativePath))
        );
        entries.push({
            url: "./" + relativePath,
            revision: digest(contents),
            size: contents.byteLength
        });
    }

    const workerContents = canonicalRuntimeContent(
        "service-worker.js",
        await fs.readFile(path.join(projectRoot, "service-worker.js"))
    );
    const versionSeed = entries
        .map((entry) => entry.url + "\0" + entry.revision)
        .concat("./service-worker.js\0" + digest(workerContents))
        .join("\n");

    return {
        version: digest(versionSeed),
        totalBytes: entries.reduce((total, entry) => total + entry.size, 0),
        entries
    };
}

export function renderPrecacheManifest(data) {
    return [
        '"use strict";',
        "",
        "self.DELAVNICA_PRECACHE = Object.freeze(" + JSON.stringify(data, null, 4) + ");",
        ""
    ].join("\n");
}

export async function generatePrecache({ check = false } = {}) {
    const expected = renderPrecacheManifest(await createPrecacheData());
    if (check) {
        let actual = "";
        try {
            actual = await fs.readFile(outputPath, "utf8");
        } catch (error) {
            if (!error || error.code !== "ENOENT") {
                throw error;
            }
        }
        if (actual.replace(/\r\n/g, "\n") !== expected) {
            throw new Error("precache-manifest.js is stale. Run npm run build.");
        }
        return;
    }
    await fs.writeFile(outputPath, expected, "utf8");
}

const isDirectRun = process.argv[1]
    && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
    generatePrecache({ check: process.argv.includes("--check") }).catch((error) => {
        console.error(error.message || error);
        process.exitCode = 1;
    });
}
