import { prisma } from "@/lib/server/db/prisma";
import { dispatchCircleWebhook } from "@/lib/server/webhooks/dispatch";
import { processTreasurySweep } from "@/lib/server/circle/treasurySweep";

async function main() {
  const idArg = process.argv[2];
  if (!idArg) {
    console.error("Usage: tsx scripts/replay-webhook-event.ts <PaymentEvent.id | circleEventId>");
    process.exit(1);
  }

  const evt = await prisma.paymentEvent.findFirst({
    where: { OR: [{ id: idArg }, { circleEventId: idArg }] },
  });
  if (!evt) {
    console.error(`PaymentEvent not found: ${idArg}`);
    process.exit(1);
  }

  console.log(`Replaying ${evt.eventType} (${evt.circleEventId}) — current status: ${evt.status}`);

  if (evt.status === "processed") {
    await prisma.paymentEvent.update({
      where: { id: evt.id },
      data: { status: "received", processedAt: null },
    });
    console.log("  reset status: processed → received");
  }

  const payload = evt.rawPayload as Parameters<typeof dispatchCircleWebhook>[0];
  const result = await dispatchCircleWebhook(payload, payload, evt.signatureKeyId);
  if (
    "treasurySweepId" in result &&
    typeof result.treasurySweepId === "string"
  ) {
    await processTreasurySweep(result.treasurySweepId);
  }
  console.log("Dispatch result:", JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error("Replay failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
