import { mkdir, appendFile, readFile, access } from "node:fs/promises";
import path from "node:path";

export type PublishDeliveryLog = {
  id: string;
  receivedAt: string;
  platform: string;
  username: string | null;
  accountId: string | null;
  title: string | null;
  body: string;
  hashtags: string[];
  caption: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  externalPostId: string;
  sourceIp?: string | null;
  userAgent?: string | null;
};

const DATA_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(DATA_DIR, "publish-deliveries.jsonl");

async function ensureLogFile() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Read-only FS (serverless) — skip silently
  }
  try {
    await access(LOG_FILE);
  } catch {
    try {
      await appendFile(LOG_FILE, "", "utf8");
    } catch {
      // Read-only FS — skip
    }
  }
}

export async function appendPublishDelivery(
  entry: Omit<PublishDeliveryLog, "id" | "receivedAt" | "externalPostId"> & {
    externalPostId?: string;
  },
): Promise<PublishDeliveryLog> {
  await ensureLogFile();
  const receivedAt = new Date().toISOString();
  const id = `dlv_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const externalPostId = entry.externalPostId || `hook_${Date.now()}`;
  const row: PublishDeliveryLog = {
    id,
    receivedAt,
    externalPostId,
    platform: entry.platform,
    username: entry.username,
    accountId: entry.accountId,
    title: entry.title,
    body: entry.body,
    hashtags: entry.hashtags,
    caption: entry.caption,
    scheduledFor: entry.scheduledFor,
    publishedAt: entry.publishedAt,
    sourceIp: entry.sourceIp || null,
    userAgent: entry.userAgent || null,
  };
  try {
    await appendFile(LOG_FILE, JSON.stringify(row) + "\n", "utf8");
  } catch {
    // FS not writable — delivery still logged via DB elsewhere
  }
  return row;
}

export async function listPublishDeliveries(limit = 50): Promise<PublishDeliveryLog[]> {
  await ensureLogFile();
  let raw = "";
  try {
    raw = await readFile(LOG_FILE, "utf8");
  } catch {
    return [];
  }
  if (!raw.trim()) return [];

  const rows = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as PublishDeliveryLog;
      } catch {
        return null;
      }
    })
    .filter((row): row is PublishDeliveryLog => Boolean(row));

  return rows.reverse().slice(0, Math.min(Math.max(limit, 1), 200));
}