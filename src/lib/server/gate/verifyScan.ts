import crypto from "node:crypto";
import { prisma } from "@/lib/server/db/prisma";
import { hashToken, parseQrPayload } from "@/lib/server/tickets/qrToken";
import type { ScanResult } from "@prisma/client";

export type GateScanOutcome = {
  result: ScanResult;
  ticket?: {
    id: string;
    eventName: string;
    fanEmail: string;
    seatLabel: string | null;
    ticketTypeName: string;
  };
  detail?: string;
};

export async function verifyScan(params: {
  qrPayload: string;
  scannerId?: string;
  ipHash?: string;
}): Promise<GateScanOutcome> {
  const parsed = parseQrPayload(params.qrPayload);
  if (!parsed) {
    await logScan({ result: "invalid", scannerId: params.scannerId, ipHash: params.ipHash });
    return { result: "invalid", detail: "malformed_payload" };
  }

  const tokenHash = hashToken(parsed.token);

  // Atomic redemption: claim the qr_token row only if it's still active and not expired.
  const claimed = await prisma.$queryRaw<
    Array<{ id: string; ticket_id: string; status: string; expires_at: Date; version: number }>
  >`
    UPDATE "QrToken"
    SET status = 'used', "usedAt" = now(), version = version + 1
    WHERE "tokenHash" = ${tokenHash}
      AND "ticketId" = ${parsed.ticketId}
      AND status = 'active'
      AND "expiresAt" > now()
    RETURNING id, "ticketId" AS ticket_id, status, "expiresAt" AS expires_at, version
  `;

  if (claimed.length === 0) {
    // Diagnose why
    const existing = await prisma.qrToken.findUnique({
      where: { tokenHash },
      include: { ticket: true },
    });
    if (!existing) {
      await logScan({
        result: "invalid",
        scannerId: params.scannerId,
        ipHash: params.ipHash,
      });
      return { result: "invalid", detail: "token_not_found" };
    }

    let result: ScanResult = "invalid";
    if (existing.status === "used") result = "already_used";
    else if (existing.status === "revoked") result = "revoked";
    else if (existing.status === "expired" || existing.expiresAt.getTime() < Date.now())
      result = "expired";

    await logScan({
      result,
      qrTokenId: existing.id,
      ticketId: existing.ticketId,
      scannerId: params.scannerId,
      ipHash: params.ipHash,
    });
    return { result, detail: `token_status:${existing.status}` };
  }

  const claimedRow = claimed[0];
  const ticket = await prisma.ticket.update({
    where: { id: claimedRow.ticket_id },
    data: { status: "used" },
    include: {
      event: true,
      fan: true,
      orderItem: { include: { ticketType: true } },
    },
  });

  await logScan({
    result: "ok",
    qrTokenId: claimedRow.id,
    ticketId: ticket.id,
    scannerId: params.scannerId,
    ipHash: params.ipHash,
  });

  return {
    result: "ok",
    ticket: {
      id: ticket.id,
      eventName: ticket.event.name,
      fanEmail: ticket.fan.email,
      seatLabel: ticket.seatLabel,
      ticketTypeName: ticket.orderItem.ticketType.name,
    },
  };
}

async function logScan(input: {
  result: ScanResult;
  qrTokenId?: string;
  ticketId?: string;
  scannerId?: string;
  ipHash?: string;
}) {
  await prisma.scanEvent.create({
    data: {
      result: input.result,
      qrTokenId: input.qrTokenId ?? null,
      ticketId: input.ticketId ?? null,
      scannerId: input.scannerId ?? null,
      ipHash: input.ipHash ?? null,
    },
  });
}

export function hashIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
