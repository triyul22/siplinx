import { Resend } from "resend";
import {
  EmailTemplate,
  CtaKind,
  Lang,
  LocalizedCopy,
  getTemplate,
  pickLang,
} from "./emailTemplates";
import {
  getEmailPrefs,
  reserveSend,
  markSent,
  releaseSend,
  makeUnsubToken,
} from "./emailPrefs";
import { pool } from "./db";

/**
 * Отправка писем секвенции через Resend.
 *
 * sendTemplate(userId, template):
 *  1) проверяет отписку и (для рекламных) marketing_opt_in;
 *  2) резервирует отправку в email_log (защита от дублей и гонки cron);
 *  3) рендерит HTML+текст на языке юзера, шлёт через Resend;
 *  4) фиксирует resend_id/status или откатывает резерв при ошибке.
 */

let _resend: Resend | null = null;
function resend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

const FROM = process.env.EMAIL_FROM || "Julia from Siplinx <julia@mail.siplinx.ai>";
const REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;
const SITE_URL = (process.env.EMAIL_SITE_URL || "https://siplinx.ai").replace(/\/$/, "");
const PUBLIC_URL = (process.env.BETTER_AUTH_URL || "http://localhost:3210").replace(/\/$/, "");
const BRAND_GRAD = "linear-gradient(135deg,#2F6BFF 0%,#7A3BE0 100%)";

/**
 * Куда ведёт кнопка. Реальная покупка/активация промокода происходит ВНУТРИ
 * десктоп-приложения (openCheckout / redeemTrial), поэтому письма возвращают
 * юзера в приложение, а не на веб-чекаут (веб-сессии у него может не быть).
 * Ссылку можно переопределить через EMAIL_APP_URL (напр. deep link siplinx://).
 */
function ctaUrl(kind: CtaKind): string {
  const app = process.env.EMAIL_APP_URL || SITE_URL;
  switch (kind) {
    case "checkout_trial7":
    case "redeem_comeback":
    case "portal":
    case "app":
    default:
      return app;
  }
}

type UserRow = { email: string; name: string | null };

async function loadUser(userId: string): Promise<UserRow | null> {
  // Better Auth хранит юзеров в таблице "user" (id, email, name...).
  const { rows } = await pool.query(
    `SELECT email, name FROM "user" WHERE id = $1`,
    [userId]
  );
  if (!rows.length || !rows[0].email) return null;
  return { email: rows[0].email, name: rows[0].name ?? null };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function footer(lang: Lang, unsubUrl: string): { html: string; text: string } {
  if (lang === "ru") {
    return {
      html: `Вы получили это письмо, потому что создали аккаунт Siplinx.<br/><a href="${unsubUrl}" style="color:#94A0B0;">Отписаться</a>`,
      text: `Вы получили это письмо, потому что создали аккаунт Siplinx.\nОтписаться: ${unsubUrl}`,
    };
  }
  return {
    html: `You are receiving this because you created a Siplinx account.<br/><a href="${unsubUrl}" style="color:#94A0B0;">Unsubscribe</a>`,
    text: `You are receiving this because you created a Siplinx account.\nUnsubscribe: ${unsubUrl}`,
  };
}

/** Одноколоночная вёрстка, системные шрифты, одна кнопка, без картинок. */
export function renderEmail(
  copy: LocalizedCopy,
  ctaHref: string,
  lang: Lang,
  unsubUrl: string
): { html: string; text: string } {
  const foot = footer(lang, unsubUrl);
  const paras = copy.body
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#0E1116;">${esc(p)}</p>`
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(
    copy.subject
  )}</title></head>
<body style="margin:0;background:#F4F6FA;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(copy.preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;">
<tr><td style="padding:28px 32px 8px;">
<div style="font-size:20px;font-weight:800;letter-spacing:-0.4px;color:#0E1116;">Siplinx <span style="background:${BRAND_GRAD};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#7A3BE0;">AI</span></div>
</td></tr>
<tr><td style="padding:12px 32px 4px;">${paras}</td></tr>
<tr><td style="padding:8px 32px 28px;">
<a href="${ctaHref}" style="display:inline-block;background:${BRAND_GRAD};color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:10px;">${esc(
    copy.cta
  )}</a>
</td></tr>
<tr><td style="padding:0 32px 26px;border-top:1px solid #EEF1F6;">
<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94A0B0;">${foot.html}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text =
    copy.body.join("\n\n") +
    `\n\n${copy.cta}: ${ctaHref}\n\n----\n${foot.text}`;

  return { html, text };
}

export type SendResult =
  | { ok: true; resendId: string | null }
  | { ok: false; reason: "unsubscribed" | "no_optin" | "no_email" | "already_sent" | "no_resend" | "error" };

export async function sendTemplate(userId: string, templateKey: string): Promise<SendResult> {
  const tpl: EmailTemplate | undefined = getTemplate(templateKey);
  if (!tpl) return { ok: false, reason: "error" };

  const prefs = await getEmailPrefs(userId);
  if (prefs.unsubscribedAt) return { ok: false, reason: "unsubscribed" };
  // Рекламные (win-back) — только по явному согласию.
  if (tpl.marketing && !prefs.marketingOptIn) return { ok: false, reason: "no_optin" };

  const user = await loadUser(userId);
  if (!user) return { ok: false, reason: "no_email" };

  // Резерв — до отправки, чтобы гонка двух cron не отправила дважды.
  const reserved = await reserveSend(userId, templateKey);
  if (!reserved) return { ok: false, reason: "already_sent" };

  const lang: Lang = pickLang(prefs.locale);
  const copy: LocalizedCopy = tpl[lang];
  const unsubUrl = `${PUBLIC_URL}/api/email/unsubscribe?token=${makeUnsubToken(userId)}`;
  const { html, text } = renderEmail(copy, ctaUrl(tpl.ctaKind), lang, unsubUrl);

  const client = resend();
  if (!client) {
    // Нет ключа (напр. локальная разработка) — откатываем резерв.
    await releaseSend(userId, templateKey);
    return { ok: false, reason: "no_resend" };
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM,
      to: user.email,
      subject: copy.subject,
      html,
      text,
      replyTo: REPLY_TO,
      headers: {
        "List-Unsubscribe": `<${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (error) {
      await releaseSend(userId, templateKey);
      console.error(`[emails] send failed user=${userId} tpl=${templateKey}`, error);
      return { ok: false, reason: "error" };
    }
    await markSent(userId, templateKey, data?.id ?? null, "sent");
    console.log(`[emails] sent user=${userId} tpl=${templateKey} id=${data?.id}`);
    return { ok: true, resendId: data?.id ?? null };
  } catch (e) {
    await releaseSend(userId, templateKey);
    console.error(`[emails] exception user=${userId} tpl=${templateKey}`, e);
    return { ok: false, reason: "error" };
  }
}
