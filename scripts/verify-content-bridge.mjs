/**
 * Verifikasi perilaku bridge satu-klik tanpa Chrome.
 *
 * Menjalankan content.js dan background.js apa adanya di dalam vm sandbox
 * berisi stub chrome.* / window / fetch, lalu memeriksa:
 *
 *   1. content.js mengumumkan diri saat dimuat dan menjawab ping
 *   2. hanya event dari window & origin yang sama yang diproses
 *   3. token / platform kosong atau platform tak dikenal ditolak
 *   4. hasil worker diteruskan balik ke halaman
 *   5. background MENOLAK platform di luar daftar putih
 *   6. background MENGABAIKAN apiBase yang dikirim halaman — tujuan cookie
 *      selalu asal pengirim (sender.origin), bukan nilai yang disuntik
 *
 * Jalankan: node scripts/verify-content-bridge.mjs
 * Exit 0 = semua lulus.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const extDir = join(here, "..", "extensions", "komenin-connect");

let failures = 0;
let checks = 0;

function check(label, condition, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const CHANNEL = "komenin:pairing";

/* ------------------------------------------------------------------ */
/* 1. content.js                                                       */
/* ------------------------------------------------------------------ */
console.log("\ncontent.js");

function loadContentScript({ origin = "https://komenin.id" } = {}) {
  const posted = [];
  const listeners = [];
  const forwarded = [];

  const chromeStub = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        forwarded.push(message);
        // default: worker succeeds
        setTimeout(() => callback?.({ ok: true, message: "Sesi terkirim ke Komenin.", cookieCount: 7 }), 0);
        return true;
      },
    },
  };

  const windowStub = {
    location: { origin },
    addEventListener(type, fn) {
      if (type === "message") listeners.push(fn);
    },
    removeEventListener(type, fn) {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    postMessage(data, target) {
      posted.push({ data, target });
    },
  };

  const context = vm.createContext({
    window: windowStub,
    chrome: chromeStub,
    setTimeout,
    clearTimeout,
    URL,
    console,
    __forwarded: forwarded,
    __posted: posted,
    __emit(event) {
      for (const fn of [...listeners]) fn(event);
    },
  });

  vm.runInContext(readFileSync(join(extDir, "content.js"), "utf8"), context, {
    filename: "content.js",
  });

  return { context, posted, forwarded, emit: (e) => context.__emit(e) };
}

function eventFrom(origin, data, source) {
  return { origin, source, data };
}

const ownOrigin = "https://komenin.id";
const pageOrigin = {}; // stands in for window — event.source must be this

await (async () => {
  const ext = loadContentScript({ origin: ownOrigin });

  check(
    "mengumumkan ready saat dimuat",
    ext.posted.some((m) => m.data?.type === CHANNEL && m.data.action === "ready"),
  );

  // ping -> available
  ext.posted.length = 0;
  ext.emit(eventFrom(ownOrigin, { type: CHANNEL, action: "ping" }, ext.context.window));
  check(
    "menjawab ping dengan available",
    ext.posted.some((m) => m.data?.action === "available"),
    JSON.stringify(ext.posted),
  );

  // origin beda -> diabaikan
  ext.posted.length = 0;
  ext.emit(eventFrom("https://evil.example", { type: CHANNEL, action: "ping" }, ext.context.window));
  check(
    "event dari origin asing diabaikan",
    ext.posted.length === 0,
    JSON.stringify(ext.posted),
  );

  // source beda (frame lain) -> diabaikan
  ext.posted.length = 0;
  ext.emit(eventFrom(ownOrigin, { type: CHANNEL, action: "ping" }, {}));
  check(
    "event dari sumber lain diabaikan",
    ext.posted.length === 0,
    JSON.stringify(ext.posted),
  );

  // channel lain -> diabaikan
  ext.posted.length = 0;
  ext.emit(eventFrom(ownOrigin, { type: "other", action: "ping" }, ext.context.window));
  check(
    "event di channel lain diabaikan",
    ext.posted.length === 0,
    JSON.stringify(ext.posted),
  );

  // connect tanpa token -> ditolak, tidak sampai ke worker
  ext.forwarded.length = 0;
  ext.posted.length = 0;
  ext.emit(
    eventFrom(
      ownOrigin,
      { type: CHANNEL, action: "connect", token: "", platform: "instagram" },
      ext.context.window,
    ),
  );
  check(
    "token kosong ditolak sebelum ke worker",
    ext.forwarded.length === 0 &&
      ext.posted.some((m) => m.data.action === "result" && m.data.ok === false),
    JSON.stringify(ext.forwarded),
  );

  // platform tak dikenal -> ditolak
  ext.forwarded.length = 0;
  ext.posted.length = 0;
  ext.emit(
    eventFrom(
      ownOrigin,
      { type: CHANNEL, action: "connect", token: "tok", platform: "facebook" },
      ext.context.window,
    ),
  );
  check(
    "platform di luar whitelist ditolak",
    ext.forwarded.length === 0 &&
      ext.posted.some((m) => m.data.action === "result" && m.data.ok === false),
    JSON.stringify(ext.forwarded),
  );

  // connect sah -> diteruskan
  ext.forwarded.length = 0;
  ext.posted.length = 0;
  ext.emit(
    eventFrom(
      ownOrigin,
      { type: CHANNEL, action: "connect", token: "tok-123", platform: "threads", apiBase: "https://komenin.id" },
      ext.context.window,
    ),
  );
  check(
    "connect sah diteruskan ke worker",
    ext.forwarded.length === 1 &&
      ext.forwarded[0].type === "komenin_auto_connect" &&
      ext.forwarded[0].token === "tok-123" &&
      ext.forwarded[0].platform === "threads",
    JSON.stringify(ext.forwarded),
  );

  // jawaban worker diteruskan balik
  await new Promise((r) => setTimeout(r, 20));
  check(
    "hasil worker diteruskan balik ke halaman",
    ext.posted.some(
      (m) => m.data.action === "result" && m.data.ok === true && m.data.cookieCount === 7,
    ),
    JSON.stringify(ext.posted),
  );
  // balasan juga harus ditujukan ke origin halaman, bukan "*"
  check(
    "balasan diarahkan ke origin halaman (bukan wildcard)",
    ext.posted.every((m) => m.target === ownOrigin),
    JSON.stringify(ext.posted.map((m) => m.target)),
  );
})();

/* ------------------------------------------------------------------ */
/* 2. background.js — jalur auto, termasuk guard apiBase               */
/* ------------------------------------------------------------------ */
console.log("\nbackground.js (komenin_auto_connect)");

async function runBackground({ message, sender, cookies = [], fetchResult = {} }) {
  const calls = [];
  const listenerRef = {};

  const chromeStub = {
    runtime: {
      onMessage: {
        addListener(fn) {
          listenerRef.fn = fn;
        },
      },
    },
    storage: {
      local: {
        stored: {},
        async get(keys) {
          const out = {};
          for (const k of keys) out[k] = this.stored[k];
          return out;
        },
        async set(values) {
          Object.assign(this.stored, values);
        },
      },
    },
    cookies: {
      async getAll({ url }) {
        calls.push({ kind: "cookies.getAll", url });
        return cookies;
      },
    },
    tabs: {
      async query() {
        return [{ url: "https://www.instagram.com/" }];
      },
    },
  };

  const context = vm.createContext({
    chrome: chromeStub,
    fetch: async (url, options) => {
      calls.push({ kind: "fetch", url, options });
      return {
        ok: fetchResult.ok ?? true,
        status: fetchResult.status ?? 200,
        async json() {
          return fetchResult.json ?? { ok: true, message: "Sesi terkirim ke Komenin.", cookieCount: cookies.length };
        },
      };
    },
    URL,
    console,
    setTimeout,
    clearTimeout,
    __calls: calls,
    __chrome: chromeStub,
  });

  vm.runInContext(readFileSync(join(extDir, "background.js"), "utf8"), context, {
    filename: "background.js",
  });

  const result = await new Promise((resolve) => {
    const responded = listenerRef.fn(message, sender, resolve);
    if (responded !== true) resolve({ ok: false, message: "listener tidak async" });
  });

  return { result, calls, stored: chromeStub.storage.local.stored };
}

// platform tak dikenal
{
  const { result, calls } = await runBackground({
    message: { type: "komenin_auto_connect", token: "t", platform: "facebook", apiBase: "https://komenin.id" },
    sender: { origin: "https://komenin.id" },
  });
  check(
    "menolak platform di luar whitelist",
    result.ok === false && calls.length === 0,
    JSON.stringify({ result, calls }),
  );
}

// token kosong
{
  const { result, calls } = await runBackground({
    message: { type: "komenin_auto_connect", token: "", platform: "instagram", apiBase: "https://komenin.id" },
    sender: { origin: "https://komenin.id" },
  });
  check(
    "menolak token kosong",
    result.ok === false && calls.length === 0,
    JSON.stringify(result),
  );
}

// asal pengirim bukan https -> ditolak
{
  const { result, calls } = await runBackground({
    message: { type: "komenin_auto_connect", token: "t", platform: "instagram", apiBase: "https://komenin.id" },
    sender: { origin: "http://evil.example" },
  });
  check(
    "menolak asal pengirim non-https",
    result.ok === false && calls.length === 0,
    JSON.stringify(result),
  );
}

// inti: apiBase yang disuntik halaman DIABAIKAN
{
  const { result, calls, stored } = await runBackground({
    message: {
      type: "komenin_auto_connect",
      token: "tok-xyz",
      platform: "instagram",
      apiBase: "https://attacker.example", // nilai jahat
    },
    sender: { origin: "https://komenin.id" },
    cookies: [
      { name: "sessionid", value: "abc", domain: ".instagram.com", path: "/", secure: true, httpOnly: true },
      { name: "csrftoken", value: "xyz", domain: ".instagram.com", path: "/", secure: true, httpOnly: false },
    ],
  });

  const fetchCall = calls.find((c) => c.kind === "fetch");
  const cookieCall = calls.find((c) => c.kind === "cookies.getAll");

  check("result sukses", result.ok === true, JSON.stringify(result));
  check(
    "cookie dibaca dari asal platform, bukan tab aktif",
    cookieCall?.url === "https://www.instagram.com/",
    cookieCall?.url,
  );
  check(
    "tujuan fetch = asal pengirim, bukan apiBase yang disuntik",
    fetchCall?.url === "https://komenin.id/api/connectors/session/ingest",
    fetchCall?.url,
  );
  check(
    "nilai apiBase jahat tidak tersimpan di config",
    stored.apiBase === "https://komenin.id",
    stored.apiBase,
  );
  check(
    "payload membawa seluruh cookie termasuk HttpOnly",
    JSON.parse(fetchCall.options.body).cookies.length === 2 &&
      JSON.parse(fetchCall.options.body).cookies[0].httpOnly === true,
    fetchCall?.options?.body,
  );
  check(
    "payload memuat token pasangan",
    JSON.parse(fetchCall.options.body).token === "tok-xyz",
  );
}

// server menolak -> pesan diteruskan apa adanya
{
  const { result } = await runBackground({
    message: { type: "komenin_auto_connect", token: "t", platform: "threads", apiBase: "https://komenin.id" },
    sender: { origin: "https://komenin.id" },
    cookies: [{ name: "sessionid", value: "a", domain: ".threads.net", path: "/", secure: true, httpOnly: true }],
    fetchResult: { ok: false, status: 403, json: { ok: false, message: "Token kedaluwarsa atau tidak valid." } },
  });
  check(
    "penolakan server diteruskan utuh",
    result.ok === false && result.message === "Token kedaluwarsa atau tidak valid.",
    JSON.stringify(result),
  );
}

/* ------------------------------------------------------------------ */
console.log(`\n${checks - failures}/${checks} lulus`);
if (failures > 0) {
  console.error(`${failures} gagal`);
  process.exit(1);
}
console.log("SEMUA LULUS");
