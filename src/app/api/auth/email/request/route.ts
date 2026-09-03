import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { issueEmailOtp, normalizeEmail } from "@/lib/email-otp";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { jsonErrorFromUnknown } from "@/lib/api-route";

export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().trim().email().max(200),
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Request an email OTP. Always responds with a generic success (never reveals
 * whether the email is registered — account auto-creates on first verify).
 * Rate-limited per IP + per email to prevent code-spam and enumeration.
 */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  // Per-IP rate limit (loose) — protects the email provider quota.
  const ipRate = await consumeRateLimit({
    key: getRequestRateKey(request, "auth:email:request:ip"),
    limit: 10,
    windowMs: 60_000,
  });
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi sebentar lagi." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Alamat email tidak valid." }, { status: 400 });
  }
  const email = normalizeEmail(parsed.data.email);

  // Per-email rate limit (tight) — a single inbox can't be spammed.
  const emailRate = await consumeRateLimit({
    key: `auth:email:request:${email}`,
    limit: 3,
    windowMs: 10 * 60_000,
  });
  if (!emailRate.ok) {
    return NextResponse.json(
      { error: "Kode sudah dikirim baru-baru ini. Periksa email Anda atau coba lagi nanti." },
      { status: 429 },
    );
  }

  try {
    const { code, expiresAt } = await issueEmailOtp(email);
    const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);

    if (!isEmailConfigured()) {
      // Don't leak the code in production; in dev, surface it for testing.
      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({ ok: true, devCode: code, delivered: false });
      }
      return NextResponse.json(
        { error: "Layanan email belum dikonfigurasi. Hubungi administrator." },
        { status: 503 },
      );
    }

    const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#0b0f14;">Kode masuk Komenin Anda</h2>
      <p style="color:#374151;">Masukkan kode 6 digit ini untuk melanjutkan:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700;color:#0b0f14;margin:24px 0;">
        ${escapeHtml(code)}
      </p>
      <p style="color:#6b7280;font-size:13px;">
        Kode berlaku ${minutes} menit dan hanya bisa dipakai sekali.
        Jika Anda tidak meminta kode ini, abaikan email ini.
      </p>
    </div>`;

    const result = await sendEmail({
      to: email,
      subject: `${code} — kode masuk Komenin Anda`,
      html,
      text: `Kode masuk Komenin Anda: ${code}\n\nBerlaku ${minutes} menit, satu kali pakai. Abaikan jika Anda tidak memintanya.`,
    });

    if (!result.delivered) {
      return NextResponse.json(
        { error: "Gagal mengirim email. Coba lagi sebentar lagi." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, delivered: true });
  } catch (error) {
    return jsonErrorFromUnknown(error, "Gagal memproses permintaan kode.");
  }
}
