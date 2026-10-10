const $ = (id) => document.getElementById(id);

function show(text, kind) {
  const el = $("status");
  el.textContent = text;
  el.className = `show ${kind || ""}`;
}

async function init() {
  const { config } = await chrome.runtime.sendMessage({ type: "komenin_get_config" });
  if (!config) return;
  $("apiBase").value = config.apiBase || "";
  $("token").value = config.token || "";
  $("platform").value = config.platform || "instagram";
}

async function save() {
  await chrome.runtime.sendMessage({
    type: "komenin_save_config",
    apiBase: $("apiBase").value.trim(),
    token: $("token").value.trim(),
    platform: $("platform").value,
  });
  show("Pengaturan tersimpan.", "ok");
}

async function connect() {
  const btn = $("connect");
  btn.disabled = true;
  show("Membaca cookie dan mengirim…");
  try {
    await chrome.runtime.sendMessage({
      type: "komenin_save_config",
      apiBase: $("apiBase").value.trim(),
      token: $("token").value.trim(),
      platform: $("platform").value,
    });
    const res = await chrome.runtime.sendMessage({ type: "komenin_connect" });
    if (res?.ok) {
      show(res.message, "ok");
    } else {
      show(res?.message || "Gagal menyambungkan.", "bad");
    }
  } catch (error) {
    show(error?.message || "Ekstensi gagal dijalankan.", "bad");
  } finally {
    btn.disabled = false;
  }
}

$("save").addEventListener("click", save);
$("connect").addEventListener("click", connect);
init();
