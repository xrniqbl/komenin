/**
 * Komenin Connect — content script injected into the web app.
 *
 * Bridge between the Connect wizard and the background worker. The page can
 * never touch chrome.* APIs, and it can never read HttpOnly cookies either —
 * so it posts a pairing request over window.postMessage, this script forwards
 * it to the worker, and the worker's answer comes back the same way.
 *
 * One click on "Buat token" is therefore the whole flow:
 *   page -> content script -> background -> cookies -> ingest -> wizard polls
 *
 * Everything crossing the boundary is validated here as well as in the
 * worker: same window, same origin, known action, known platform.
 */

const CHANNEL = "komenin:pairing";
const SUPPORTED_PLATFORMS = ["instagram", "threads"];

function reply(payload) {
  window.postMessage({ type: CHANNEL, ...payload }, window.location.origin);
}

window.addEventListener("message", (event) => {
  // Only the page's own frame, only from the app origin.
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;

  const data = event.data;
  if (!data || data.type !== CHANNEL) return;
  if (typeof data.action !== "string") return;

  if (data.action === "ping") {
    reply({ action: "available" });
    return;
  }

  if (data.action !== "connect") return;

  const token = typeof data.token === "string" ? data.token.trim() : "";
  const platform = typeof data.platform === "string" ? data.platform.trim() : "";
  const apiBase = typeof data.apiBase === "string" ? data.apiBase.trim() : "";

  if (!token || !platform) {
    reply({ action: "result", ok: false, message: "Token atau platform kosong." });
    return;
  }
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    reply({ action: "result", ok: false, message: `Platform tidak didukung: ${platform}` });
    return;
  }

  let settled = false;
  const finish = (payload) => {
    if (settled) return;
    settled = true;
    reply(payload);
  };

  // If the worker dies (extension reloaded, context invalidated) the callback
  // never fires — time out so the wizard is never left hanging.
  const timer = setTimeout(() => {
    finish({
      action: "result",
      ok: false,
      message: "Ekstensi tidak menjawab. Muat ulang halaman atau pasang ulang ekstensi.",
    });
  }, 20000);

  try {
    chrome.runtime.sendMessage(
      { type: "komenin_auto_connect", token, platform, apiBase },
      (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          finish({
            action: "result",
            ok: false,
            message: "Ekstensi tidak aktif. Muat ulang halaman ini.",
          });
          return;
        }
        finish({
          action: "result",
          ok: Boolean(response?.ok),
          message: response?.message || "Tidak ada jawaban dari ekstensi.",
          cookieCount: response?.cookieCount || 0,
        });
      },
    );
  } catch {
    clearTimeout(timer);
    finish({
      action: "result",
      ok: false,
      message: "Ekstensi sudah dilepas. Pasang ulang lewat chrome://extensions.",
    });
  }
});

// Announce ourselves so the wizard can tell "extension installed" from
// "extension missing" instead of guessing.
reply({ action: "ready" });
