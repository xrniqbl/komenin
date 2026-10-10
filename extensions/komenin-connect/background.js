/**
 * Komenin Connect — background service worker.
 *
 * Two ways in, one destination:
 *
 *  - `komenin_connect` (popup): the operator is sitting on instagram.com /
 *    threads.net and clicks Sambungkan. Uses the ACTIVE TAB so the guard can
 *    tell them "you are on the wrong site" instead of silently pulling the
 *    wrong account.
 *
 *  - `komenin_auto_connect` (content script on the Komenin web app): the
 *    operator clicks "Buat token" on the Connect wizard. The page hands us the
 *    pairing token and we pull cookies straight from the platform origin — no
 *    popup, no paste. This is the one-click path.
 *
 * Both read ALL cookies for the origin, including HttpOnly, which page
 * JavaScript can never see. That is the entire reason this extension exists.
 */

const ORIGIN_TO_PLATFORM = {
  "www.instagram.com": "instagram",
  "instagram.com": "instagram",
  "www.threads.net": "threads",
  "threads.net": "threads",
  "www.threads.com": "threads",
  "threads.com": "threads",
};

/** Where we pull cookies from when nobody is looking at the platform tab. */
const PLATFORM_HOME_URL = {
  instagram: "https://www.instagram.com/",
  threads: "https://www.threads.net/",
};

/** Platforms the extension will ever touch. Anything else is refused. */
const SUPPORTED_PLATFORMS = ["instagram", "threads"];

function platformForHost(host) {
  return ORIGIN_TO_PLATFORM[host] || null;
}

async function getConfig() {
  const stored = await chrome.storage.local.get(["apiBase", "token", "platform"]);
  return {
    apiBase: (stored.apiBase || "").replace(/\/+$/, ""),
    token: stored.token || "",
    platform: stored.platform || "",
  };
}

/**
 * Read every cookie for `url` and hand them to the ingest bridge.
 * Shared by the popup path and the one-click path so the payload shape and
 * the error wording can never drift apart.
 */
async function collectAndSend(url, token, apiBase) {
  // chrome.cookies.getAll returns HttpOnly cookies too — the whole point.
  const cookies = await chrome.cookies.getAll({ url });
  if (!cookies.length) {
    return { ok: false, message: "Tidak ada cookie. Login dulu di platform tersebut." };
  }

  const payload = {
    token,
    cookies: cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
    })),
    ua: "", // filled server-side from the platform user agent when absent
    username: "",
  };

  try {
    const response = await fetch(`${apiBase}/api/connectors/session/ingest`, {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok !== true) {
      return {
        ok: false,
        message: data.message || `Server menolak (${response.status}).`,
      };
    }
    return {
      ok: true,
      message: data.message || "Sesi terkirim ke Komenin.",
      cookieCount: data.cookieCount || cookies.length,
    };
  } catch (error) {
    return {
      ok: false,
      message: error?.message || "Gagal menghubungi server Komenin.",
    };
  }
}

/** Popup path: the operator is on the platform page right now. */
async function connect() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return { ok: false, message: "Tab aktif tidak ditemukan." };

  let host = "";
  try {
    host = new URL(tab.url).hostname;
  } catch {
    return { ok: false, message: "URL tab tidak valid." };
  }

  const pagePlatform = platformForHost(host);
  if (!pagePlatform) {
    return {
      ok: false,
      message: `Buka dulu halaman instagram.com atau threads.net (halaman sekarang: ${host}).`,
    };
  }

  const { apiBase, token, platform } = await getConfig();
  if (!apiBase) {
    return { ok: false, message: "Alamat server Komenin belum diisi di tab Pengaturan." };
  }
  if (!token) {
    return { ok: false, message: "Token belum diisi. Salin dulu dari halaman Connect Komenin." };
  }
  if (platform && platform !== pagePlatform) {
    return {
      ok: false,
      message: `Token diset untuk ${platform} tapi Anda sedang di ${pagePlatform}. Ganti platform di Pengaturan.`,
    };
  }

  return collectAndSend(tab.url, token, apiBase);
}

/**
 * One-click path: driven by the Komenin Connect wizard.
 *
 * `apiBase` is NOT trusted from the message — it is ignored and replaced with
 * the page origin the content script actually runs on. The pairing token is
 * useless without it, so a compromised or spoofed message can never aim the
 * cookie stream at a third party.
 */
async function connectForPlatform({ token, apiBase, platform, pageOrigin }) {
  if (!token) return { ok: false, message: "Token kosong. Muat ulang halaman Connect." };
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    return { ok: false, message: `Platform tidak didukung: ${platform || "(kosong)"}.` };
  }
  const origin = (pageOrigin || "").replace(/\/+$/, "");
  if (!origin || !origin.startsWith("https://")) {
    return { ok: false, message: "Asal halaman tidak sah." };
  }
  // Drop whatever apiBase the page sent; send cookies home, never elsewhere.
  const safeBase = origin;

  await chrome.storage.local.set({
    apiBase: safeBase,
    token,
    platform,
  });

  return collectAndSend(PLATFORM_HOME_URL[platform], token, safeBase);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "komenin_connect") {
    connect().then(sendResponse);
    return true; // async response
  }
  if (message?.type === "komenin_auto_connect") {
    // Only the injected content script may drive the one-click path, and only
    // from a page we actually injected into.
    const origin = sender?.origin || (sender?.url ? new URL(sender.url).origin : "");
    connectForPlatform({ ...message, pageOrigin: origin }).then(sendResponse);
    return true;
  }
  if (message?.type === "komenin_save_config") {
    chrome.storage.local
      .set({
        apiBase: message.apiBase || "",
        token: message.token || "",
        platform: message.platform || "",
      })
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "komenin_get_config") {
    getConfig().then((config) => sendResponse({ ok: true, config }));
    return true;
  }
  return false;
});
