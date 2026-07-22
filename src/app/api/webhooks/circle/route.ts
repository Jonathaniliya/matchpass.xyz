import { NextResponse } from "next/server";
import { verifyCircleSignature } from "@/lib/server/circle/webhookVerify";
import { dispatchCircleWebhook } from "@/lib/server/webhooks/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "circle-webhook" });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  const verification = await verifyCircleSignature(rawBody, req.headers);
  if (!verification.ok) {
    console.warn("circle_webhook_unverified", { reason: verification.reason });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: { notificationId?: string; notificationType?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!payload.notificationId || !payload.notificationType) {
    return NextResponse.json({ error: "missing_envelope_fields" }, { status: 400 });
  }

  try {
    const result = await dispatchCircleWebhook(
      payload as Parameters<typeof dispatchCircleWebhook>[0],
      payload,
      verification.keyId,
    );
    console.log("circle_webhook_dispatched", result);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("circle_webhook_dispatch_failed", err);
    return NextResponse.json({ error: "dispatch_failed" }, { status: 500 });
  }
}
