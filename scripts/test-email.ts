import { getFromAddress, getResend } from "@/lib/server/email/resend";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npm run email:test -- your@email.com");
    process.exit(1);
  }

  const resend = getResend();
  if (!resend) {
    console.error("RESEND_API_KEY is not set in .env.local");
    process.exit(1);
  }

  const from = getFromAddress();
  console.log(`Sending test email from ${from} to ${to}…`);

  const result = await resend.emails.send({
    from,
    to,
    subject: "MatchPass.xyz — Resend test",
    html: "<p>If you can read this, Resend wiring works. 🎟️</p>",
    text: "If you can read this, Resend wiring works.",
  });

  console.log("Result:", JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  });
