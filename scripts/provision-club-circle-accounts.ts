import { prisma } from "@/lib/server/db/prisma";
import { ensureClubCircleAccount } from "@/lib/server/circle/clubWallet";

async function main() {
  const clubs = await prisma.club.findMany({
    where: { featured: true },
    orderBy: [{ league: { tier: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });

  console.log(`Provisioning Circle DCW accounts for ${clubs.length} clubs on testnet...\n`);

  const results: Array<{
    slug: string;
    name: string;
    walletSetId: string;
    walletId: string;
    status: "created" | "existing";
  }> = [];

  let createdCount = 0;
  let skipCount = 0;

  for (const club of clubs) {
    const existing = await prisma.clubCircleAccount.findUnique({
      where: { clubId: club.id },
    });

    if (existing) {
      console.log(`  ⏭  ${club.name.padEnd(28)}  existing  walletSet=${existing.walletSetId.slice(0, 8)}…`);
      results.push({
        slug: club.slug,
        name: club.name,
        walletSetId: existing.walletSetId,
        walletId: existing.walletId,
        status: "existing",
      });
      skipCount++;
      continue;
    }

    process.stdout.write(`  ▶  ${club.name.padEnd(28)}  provisioning…`);
    const acct = await ensureClubCircleAccount(club.id);
    process.stdout.write(`\r  ✓  ${club.name.padEnd(28)}  created   walletSet=${acct.walletSetId.slice(0, 8)}… treasury=${acct.walletId.slice(0, 8)}…\n`);

    results.push({
      slug: club.slug,
      name: club.name,
      walletSetId: acct.walletSetId,
      walletId: acct.walletId,
      status: "created",
    });
    createdCount++;
  }

  console.log(`\nDone. ${createdCount} created, ${skipCount} already existed.`);
  console.log("\nProvisioned accounts:");
  console.table(
    results.map((r) => ({
      club: r.name,
      walletSetId: r.walletSetId,
      treasuryWalletId: r.walletId,
      status: r.status,
    })),
  );
}

main()
  .catch((e) => {
    console.error("\nProvisioning failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
