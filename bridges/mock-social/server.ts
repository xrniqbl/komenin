import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { handleMockBridgeRequest } from "./handler";

const PORT = Number(process.env.MOCK_BRIDGE_PORT || 8787);
const TOKEN = (process.env.MOCK_BRIDGE_TOKEN || "").trim();
const PATH = "/bridge";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-aether-contract": "v1",
    ...(extraHeaders || {}),
  });
  res.end(payload);
}

async function main() {
  if (!TOKEN || TOKEN.length < 8) {
    console.error("MOCK_BRIDGE_TOKEN is required (min 8 chars). Refusing to start.");
    process.exit(1);
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
      if (req.method === "GET" && url.pathname === "/healthz") {
        send(res, 200, { ok: true, service: "mock-social-bridge" });
        return;
      }
      if (req.method !== "POST" || url.pathname.replace(/\/$/, "") !== PATH) {
        send(res, 404, { ok: false, error: "Not found. POST /bridge" });
        return;
      }

      const auth = req.headers.authorization || "";
      const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
      if (!bearer || bearer !== TOKEN) {
        send(res, 401, { ok: false, error: "Unauthorized bridge token" });
        return;
      }

      const raw = await readBody(req);
      let json: Record<string, unknown> = {};
      if (raw.trim()) {
        try {
          json = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          send(res, 400, { ok: false, error: "Invalid JSON body" });
          return;
        }
      }

      const actionHeader = req.headers["x-aether-action"];
      if (!json.action && typeof actionHeader === "string") {
        json.action = actionHeader;
      }

      const result = handleMockBridgeRequest(
        json as Parameters<typeof handleMockBridgeRequest>[0],
      );
      send(res, result.status, result.body, result.headers);
    } catch (error) {
      send(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Mock bridge error",
      });
    }
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Mock social bridge listening on http://127.0.0.1:${PORT}${PATH}`);
    console.log("Set SOCIAL_PUBLISH_WEBHOOK_URL to that URL and matching token.");
    console.log(
      "App outbound to localhost requires ALLOW_SECURITY_STUBS=true (non-production).",
    );
  });
}

main();
