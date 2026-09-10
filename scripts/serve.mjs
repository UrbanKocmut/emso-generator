import { createReadStream, promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const host = "127.0.0.1";
const requestedPort = Number(process.argv[2] || 8765);

if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
    console.error("Port must be an integer between 1 and 65535.");
    process.exit(1);
}

const contentTypes = new Map([
    [".bcmap", "application/octet-stream"],
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".icc", "application/vnd.iccprofile"],
    [".ico", "image/x-icon"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".mjs", "text/javascript; charset=utf-8"],
    [".pdf", "application/pdf"],
    [".pfb", "application/octet-stream"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".ttf", "font/ttf"],
    [".wasm", "application/wasm"],
    [".webmanifest", "application/manifest+json; charset=utf-8"],
    [".woff", "font/woff"],
    [".woff2", "font/woff2"]
]);

function sendText(response, status, message) {
    response.writeHead(status, {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
    });
    response.end(message);
}

const server = createServer(async function (request, response) {
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.setHeader("Allow", "GET, HEAD");
        sendText(response, 405, "Method not allowed.");
        return;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    } catch (error) {
        sendText(response, 400, "Invalid URL.");
        return;
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    let filePath = path.resolve(projectRoot, relativePath);
    const normalizedRoot = projectRoot.toLowerCase() + path.sep;
    if (filePath.toLowerCase() !== projectRoot.toLowerCase() && !filePath.toLowerCase().startsWith(normalizedRoot)) {
        sendText(response, 403, "Forbidden.");
        return;
    }

    try {
        let details = await fs.stat(filePath);
        if (details.isDirectory()) {
            if (!pathname.endsWith("/")) {
                response.writeHead(308, { Location: pathname + "/", "Cache-Control": "no-store" });
                response.end();
                return;
            }
            filePath = path.join(filePath, "index.html");
            details = await fs.stat(filePath);
        }
        if (!details.isFile()) {
            throw new Error("Not a file");
        }

        response.writeHead(200, {
            "Cache-Control": "no-store",
            "Content-Length": details.size,
            "Content-Type": contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream"
        });
        if (request.method === "HEAD") {
            response.end();
            return;
        }
        createReadStream(filePath).pipe(response);
    } catch (error) {
        sendText(response, 404, "Not found.");
    }
});

server.on("error", function (error) {
    if (error.code === "EADDRINUSE") {
        console.error("Port " + requestedPort + " is already in use. Try: serve.cmd 8766");
    } else {
        console.error(error);
    }
    process.exitCode = 1;
});

server.listen(requestedPort, host, function () {
    console.log("Delavnica is running at http://" + host + ":" + requestedPort + "/");
    console.log("Open the URL above, then press Ctrl+C here to stop the server.");
});
