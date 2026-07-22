import { prisma } from "@/lib/server/db/prisma";
import { deriveQrToken } from "@/lib/server/tickets/qrToken";

async function main() {
  const tokens = await prisma.qrToken.findMany({
    where: { status: "active" },
    select: { id: true, ticketId: true, tokenHash: true },
  });

  let updated = 0;
  for (const t of tokens) {
    const { tokenHash } = deriveQrToken(t.ticketId);
    if (tokenHash === t.tokenHash) continue;
    await prisma.qrToken.update({
      where: { id: t.id },
      data: { tokenHash },
    });
    updated += 1;
    console.log(`  rederived ${t.ticketId}`);
  }

  console.log(`Done. Updated ${updated}/${tokens.length} active QR tokens.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
