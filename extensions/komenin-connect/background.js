/**
 * Komenin Connect — background service worker.
 *
 * Reads ALL cookies for the active platform origin (including HttpOnly,
 * which page JavaScript can never see — this is the entire reason the
 * extension exists) and POSTs them to the workspace ingest bridge with the
 * pairing token minted by the wizard.
 */

const ORIGIN_TO_PLATFORM = {
  "www.instagram.com": "instagram",
  "instagram.com": "instagram",
  "www.threads.net": "threads",
  "threads.net": "threads",
  "www.threads.com": "threads",
  "threads.com": "threads",
};

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

  // chrome.cookies.getAll returns HttpOnly cookies too — the whole point.
  const cookies = await chrome.cookies.getAll({ url: tab.url });
  if (!cookies.length) {
    return { ok: false, message: "Tidak ada cookie. Login dulu di tab ini." };
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "komenin_connect") {
    connect().then(sendResponse);
    return true; // async response
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
