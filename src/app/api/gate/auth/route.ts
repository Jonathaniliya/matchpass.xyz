import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { gateLoginSchema } from "@/lib/shared/schemas/gate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = gateLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const expected = process.env.GATE_STAFF_PASSWORD;
  if (!expected || parsed.data.password !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const jar = await cookies();
  jar.set("gate_auth", expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return new NextResponse(null, { status: 204 });
}
