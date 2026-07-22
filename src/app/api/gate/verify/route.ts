import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { gateScanSchema } from "@/lib/shared/schemas/gate";
import { hashIp, verifyScan } from "@/lib/server/gate/verifyScan";

export const runtime = "nodejs";

const GATE_COOKIE = "gate_auth";

export async function POST(req: Request) {
  const jar = await cookies();
  const gateCookie = jar.get(GATE_COOKIE);
  const expected = process.env.GATE_STAFF_PASSWORD;
  if (!expected || gateCookie?.value !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = gateScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const outcome = await verifyScan({
    qrPayload: parsed.data.qrPayload,
    scannerId: "gate-web",
    ipHash: hashIp(ip),
  });
  return NextResponse.json(outcome);
}
