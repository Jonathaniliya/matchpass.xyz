import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db/prisma";
import { issueTicketsForOrder } from "@/lib/server/tickets/issue";
import { sendTicketReadyEmail } from "@/lib/server/email/sendTicketReady";
import { processTreasurySweep } from "@/lib/server/circle/treasurySweep";

type InboundNotification = {
  id: string;
  blockchain?: string;
  walletId?: string;
  destinationAddress: string;
  amounts?: string[];
  state?: string;
  transactionType?: string;
  txHash?: string;
  sourceAddress?: string;
  refId?: string;
};

type WebhookEnvelope = {
  subscriptionId?: string;
  notificationId: string;
  notificationType: string;
  notification?: InboundNotification | Record<string, unknown>;
  timestamp?: string;
  version?: number;
};

export type DispatchResult =
  | { kind: "test_ping" }
  | { kind: "duplicate" }
  | { kind: "no_order_match"; depositAddress: string }
  | { kind: "review"; reason: string; orderId: string }
  | { kind: "fulfilled"; orderId: string; tickets: number }
  | { kind: "ignored"; reason: string };

export async function dispatchCircleWebhook(
  envelope: WebhookEnvelope,
  rawPayload: unknown,
  keyId: string | null,
): Promise<DispatchResult> {
  const existing = await prisma.paymentEvent.findUnique({
    where: { circleEventId: envelope.notificationId },
  });
  if (existing?.status === "processed") {
    return { kind: "duplicate" };
  }

  const paymentEvent = existing
    ? existing
    : await prisma.paymentEvent.create({
        data: {
          circleEventId: envelope.notificationId,
          eventType: envelope.notificationType,
          rawPayload: rawPayload as Prisma.InputJsonValue,
          signatureKeyId: keyId,
          status: "received",
        },
      });

  if (envelope.notificationType === "webhooks.test") {
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { status: "processed", processedAt: new Date() },
    });
    return { kind: "test_ping" };
  }

  if (envelope.notificationType === "transactions.outbound") {
    const outbound = envelope.notification as InboundNotification | undefined;
    const sweep = outbound?.refId
      ? await prisma.treasurySweep.findUnique({ where: { id: outbound.refId } })
      : null;
    if (sweep) {
      const settledStates = new Set(["COMPLETE", "COMPLETED", "CONFIRMED"]);
      const failedStates = new Set(["FAILED", "DENIED", "CANCELLED", "STUCK"]);
      await prisma.treasurySweep.update({
        where: { id: sweep.id },
        data: settledStates.has(outbound?.state ?? "")
          ? { status: "complete", completedAt: new Date() }
          : failedStates.has(outbound?.state ?? "")
            ? { status: "failed", failureReason: `circle:${outbound?.state}` }
            : { status: "submitted" },
      });
    }
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { status: "processed", processedAt: new Date() },
    });
    return { kind: "ignored", reason: sweep ? "treasury_sweep_updated" : "outbound_unmatched" };
  }

  if (envelope.notificationType !== "transactions.inbound") {
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { status: "processed", processedAt: new Date() },
    });
    return { kind: "ignored", reason: `unhandled_type:${envelope.notificationType}` };
  }

  const n = envelope.notification as InboundNotification | undefined;
  if (!n || n.transactionType !== "INBOUND") {
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { status: "processed", processedAt: new Date() },
    });
    return { kind: "ignored", reason: "not_inbound" };
  }

  const settledStates = new Set(["COMPLETE", "COMPLETED", "CONFIRMED"]);
  if (!n.state || !settledStates.has(n.state)) {
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { status: "processed", processedAt: new Date() },
    });
    return { kind: "ignored", reason: `state:${n.state ?? "unknown"}` };
  }

  const depositAddress = n.destinationAddress?.toLowerCase();
  if (!depositAddress) {
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { status: "failed" },
    });
    return { kind: "ignored", reason: "missing_destination" };
  }

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { depositAddress: n.destinationAddress },
        { depositAddress: depositAddress },
      ],
    },
    include: {
      event: {
        select: {
          clubId: true,
          club: { select: { circleAccount: true } },
        },
      },
    },
  });
  if (!order) {
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { status: "failed" },
    });
    return { kind: "no_order_match", depositAddress: n.destinationAddress };
  }

  if (!order.depositAddressKeyId || !order.event.club.circleAccount) {
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { status: "failed" },
    });
    throw new Error("order_club_wallet_configuration_missing");
  }

  const paidAmount = new Prisma.Decimal(n.amounts?.[0] ?? "0");
  const needsReview =
    order.status !== "pending" ||
    order.expiresAt.getTime() < Date.now() ||
    paidAmount.lt(order.totalUsdc);

  if (needsReview) {
    const reason =
      order.status !== "pending"
        ? `order_status:${order.status}`
        : order.expiresAt.getTime() < Date.now()
          ? "expired"
          : "underpaid";

    await prisma.$transaction(
      [
        prisma.order.update({
          where: { id: order.id },
          data: { status: "review" },
        }),
        prisma.payment.upsert({
          where: { providerTransactionId: n.id },
          update: {},
          create: {
            orderId: order.id,
            providerTransactionId: n.id,
            amountUsdc: paidAmount,
            depositAddress: n.destinationAddress,
            chain: n.blockchain ?? "ARC-TESTNET",
            sourceAddress: n.sourceAddress ?? null,
          },
        }),
        prisma.paymentEvent.update({
          where: { id: paymentEvent.id },
          data: { status: "processed", processedAt: new Date() },
        }),
      ],
      { timeout: 30_000 },
    );
    return { kind: "review", reason, orderId: order.id };
  }

  // Happy path — single transaction marks paid, creates Payment, issues tickets, marks fulfilled.
  const issuedCount = await prisma.$transaction(
    async (tx) => {
      const paidOrder = await tx.order.updateMany({
        where: { id: order.id, status: "pending" },
        data: { status: "paid", paidAt: new Date() },
      });
      if (paidOrder.count !== 1) return 0;

      await tx.payment.create({
        data: {
          orderId: order.id,
          providerTransactionId: n.id,
          amountUsdc: paidAmount,
          depositAddress: n.destinationAddress,
          chain: n.blockchain ?? "ARC-TESTNET",
          sourceAddress: n.sourceAddress ?? null,
        },
      });
      const tickets = await issueTicketsForOrder(tx, order.id);
      await tx.order.update({
        where: { id: order.id },
        data: { status: "fulfilled", fulfilledAt: new Date() },
      });
      await tx.treasurySweep.create({
        data: {
          orderId: order.id,
          clubId: order.event.clubId,
          sourceWalletId: order.depositAddressKeyId!,
          destinationWalletId: order.event.club.circleAccount!.walletId,
          amountUsdc: paidAmount,
          status: "pending",
        },
      });
      await tx.paymentEvent.update({
        where: { id: paymentEvent.id },
        data: { status: "processed", processedAt: new Date() },
      });
      return tickets.length;
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  if (issuedCount > 0) {
    const sweep = await prisma.treasurySweep.findUnique({
      where: { orderId: order.id },
      select: { id: true },
    });
    if (sweep) void processTreasurySweep(sweep.id);
    // Fire-and-forget — never block fulfillment on email delivery.
    const full = await prisma.order.findUnique({
      where: { id: order.id },
      include: { fan: true, event: { include: { club: true } } },
    });
    if (full) {
      void sendTicketReadyEmail({
        to: full.fan.email,
        fanId: full.fan.id,
        orderId: full.id,
        eventName: full.event.name,
        clubName: full.event.club.name,
        venue: full.event.venue,
        startsAt: full.event.startsAt,
        ticketCount: issuedCount,
      });
    }
  }

  return { kind: "fulfilled", orderId: order.id, tickets: issuedCount };
}
