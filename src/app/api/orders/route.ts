import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentFan } from "@/lib/server/auth/requireFan";
import {
  getGuestFanId,
  setGuestFanCookie,
} from "@/lib/server/auth/guestSession";
import { prisma } from "@/lib/server/db/prisma";
import { createOrderSchema } from "@/lib/shared/schemas/order";
import { createOrder, OrderError } from "@/lib/server/orders/create";

export const runtime = "nodejs";

const guestCreateOrderSchema = createOrderSchema.extend({
  guestEmail: z.string().email().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = guestCreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { guestEmail, ...orderInput } = parsed.data;

  // Determine the buyer: signed-in fan, or guest by email.
  let fanId: string;
  const signedInFan = await getCurrentFan();
  if (signedInFan) {
    fanId = signedInFan.id;
  } else {
    if (!guestEmail) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }
    const email = guestEmail.toLowerCase();
    const currentGuestFanId = await getGuestFanId();
    const existing = await prisma.fan.findUnique({ where: { email } });

    // Knowing an email address is not proof of identity. Reuse an existing
    // guest Fan only when this browser already holds its signed guest cookie.
    if (
      existing &&
      (existing.supabaseUserId !== null || existing.id !== currentGuestFanId)
    ) {
      return NextResponse.json(
        { error: "identity_verification_required" },
        { status: 409 },
      );
    }

    let guestFan = existing;
    if (!guestFan) {
      try {
        guestFan = await prisma.fan.create({ data: { email } });
      } catch (error) {
        // A concurrent request may have created the same unique email. Do not
        // adopt that identity without verification.
        if (isUniqueConstraintError(error)) {
          return NextResponse.json(
            { error: "identity_verification_required" },
            { status: 409 },
          );
        }
        throw error;
      }
    }

    fanId = guestFan.id;
    await setGuestFanCookie(guestFan.id);
  }

  try {
    const result = await createOrder({ fanId, input: orderInput });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("create_order_failed", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

function isUniqueConstraintError(error: unknown): error is { code: "P2002" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
