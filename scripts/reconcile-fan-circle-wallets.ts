import { prisma } from "@/lib/server/db/prisma";
import { syncFanWalletFromCircle } from "@/lib/server/circle/fanWallet";

async function main() {
  const fans = await prisma.fan.findMany({
    where: { wallet: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });

  let reconciled = 0;
  let notFound = 0;
  let failed = 0;

  for (const fan of fans) {
    try {
      const wallet = await syncFanWalletFromCircle(fan.id);
      if (!wallet) {
        notFound++;
        console.log(`${fan.email}: no Circle wallet`);
        continue;
      }

      reconciled++;
      console.log(
        `${fan.email}: reconciled ${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`,
      );
    } catch (error) {
      failed++;
      console.error(
        `${fan.email}: reconciliation failed`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log({ checked: fans.length, reconciled, notFound, failed });
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Fan wallet reconciliation failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
