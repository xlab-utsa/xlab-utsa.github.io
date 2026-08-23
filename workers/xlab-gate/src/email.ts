// Transactional email, provider-agnostic.
//
// Brevo and Resend differ only in endpoint and payload shape, so both live behind one
// function selected by the EMAIL_PROVIDER var. That matters for a system meant to be set up
// once: if a provider changes its free tier, switching is a config edit and a new secret,
// not a code change and a redeploy.
//
//   brevo  — verifies a single sender ADDRESS (a Gmail works). No domain required.
//   resend — requires a verified DOMAIN you own before it will mail arbitrary recipients.
import type { Env } from "./env";

export async function sendEmail(
  env: Env,
  to: { email: string; name?: string },
  subject: string,
  html: string,
  text: string
): Promise<void> {
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) {
    throw new Error("email is not configured (EMAIL_API_KEY / EMAIL_FROM)");
  }

  const res =
    env.EMAIL_PROVIDER === "resend"
      ? await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.EMAIL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
            to: [to.email],
            subject,
            html,
            text,
          }),
        })
      : await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": env.EMAIL_API_KEY,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
            to: [{ email: to.email, ...(to.name ? { name: to.name } : {}) }],
            subject,
            htmlContent: html,
            textContent: text,
          }),
        });

  if (!res.ok) {
    // Deliberately not surfaced to the caller's HTTP response — a failure here must never
    // reveal whether an address is on the roster.
    throw new Error(`email send failed (${env.EMAIL_PROVIDER}) ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

export function magicLinkEmail(link: string, name: string) {
  const safeName = name || "there";
  return {
    subject: "Your X-Lab Studio sign-in link",
    text:
      `Hi ${safeName},\n\nHere is your sign-in link for X-Lab Studio:\n\n${link}\n\n` +
      `It works once and expires in 15 minutes.\n\n` +
      `If you didn't request this, you can ignore this email — nothing has changed.\n`,
    html:
      `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111">` +
      `<p>Hi ${escapeHtml(safeName)},</p>` +
      `<p>Here is your sign-in link for <strong>X-Lab Studio</strong>:</p>` +
      `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:4px">Sign in to Studio</a></p>` +
      `<p style="color:#666;font-size:13px">This link works once and expires in 15 minutes.</p>` +
      `<p style="color:#666;font-size:13px">If you didn't request this, you can ignore this email — nothing has changed.</p>` +
      `</div>`,
  };
}

export function submissionStatusEmail(
  name: string,
  title: string,
  approved: boolean,
  note: string
) {
  const verdict = approved ? "approved and published" : "sent back for changes";
  return {
    subject: `Your Studio submission was ${approved ? "approved" : "returned"}`,
    text:
      `Hi ${name || "there"},\n\nYour submission "${title}" was ${verdict}.\n` +
      (note ? `\nNote from the reviewer:\n${note}\n` : "") +
      (approved ? `\nIt will appear on the site within a few minutes.\n` : ""),
    html:
      `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111">` +
      `<p>Hi ${escapeHtml(name || "there")},</p>` +
      `<p>Your submission <strong>${escapeHtml(title)}</strong> was ${verdict}.</p>` +
      (note ? `<blockquote style="border-left:3px solid #ddd;margin:0;padding-left:12px;color:#444">${escapeHtml(note)}</blockquote>` : "") +
      (approved ? `<p style="color:#666;font-size:13px">It will appear on the site within a few minutes.</p>` : "") +
      `</div>`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
