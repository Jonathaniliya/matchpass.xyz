import { getAppBaseUrl, getFromAddress, getResend } from "./resend";
import { signAccessToken } from "@/lib/server/auth/guestSession";

type Params = {
  to: string;
  fanId: string;
  orderId: string;
  eventName: string;
  clubName: string;
  venue: string;
  startsAt: Date;
  ticketCount: number;
};

export async function sendTicketReadyEmail(p: Params): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("ticket_email_skipped: RESEND_API_KEY not set");
    return;
  }

  const token = signAccessToken(p.fanId);
  const url = `${getAppBaseUrl()}/orders/${p.orderId}/access?t=${encodeURIComponent(token)}`;
  const kickoff = p.startsAt.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const subject = `Your ticket for ${p.eventName} is ready`;

  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" style="max-width:560px;background:#121214;border:1px solid #27272a;border-radius:24px;padding:32px;">
            <tr>
              <td style="padding-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#a1a1aa;">
                ${escapeHtml(p.clubName)}
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:8px;font-size:22px;font-weight:600;color:#fafafa;">
                ${escapeHtml(p.eventName)}
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;font-size:14px;color:#a1a1aa;">
                ${escapeHtml(p.venue)} · ${escapeHtml(kickoff)}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 0;border-top:1px solid #27272a;border-bottom:1px solid #27272a;color:#d4d4d8;font-size:14px;">
                Payment confirmed. ${p.ticketCount} ticket${p.ticketCount === 1 ? "" : "s"} issued.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:28px;padding-bottom:8px;">
                <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#67e8f9,#a78bfa);color:#0a0a0b;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:14px;font-size:15px;">
                  View ticket &amp; QR
                </a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:8px;font-size:12px;color:#71717a;">
                Link is valid for 14 days. Bring this code to the gate.
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:11px;color:#52525b;">
            You're receiving this because you bought a ticket on ticket.com.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${p.eventName}`,
    `${p.venue} · ${kickoff}`,
    "",
    `Payment confirmed. ${p.ticketCount} ticket${p.ticketCount === 1 ? "" : "s"} issued.`,
    "",
    `View ticket: ${url}`,
    "",
    "Link valid for 14 days.",
  ].join("\n");

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to: p.to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("ticket_email_failed", {
      to: p.to,
      orderId: p.orderId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
