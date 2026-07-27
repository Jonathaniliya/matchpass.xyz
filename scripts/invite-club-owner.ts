import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

const argsSchema = z.tuple([
  z.string().trim().min(1),
  z.string().trim().email().transform((email) => email.toLowerCase()),
]);

async function main() {
  const parsed = argsSchema.safeParse(process.argv.slice(2));
  if (!parsed.success) {
    throw new Error(
      "Usage: npm run club:invite-owner -- <club-slug> <verified-login-email>",
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const [clubSlug, email] = parsed.data;
    const club = await prisma.club.findUnique({
      where: { slug: clubSlug },
      select: { id: true, name: true },
    });
    if (!club) throw new Error(`Club not found: ${clubSlug}`);

    const fan = await prisma.fan.findUnique({
      where: { email },
      select: { supabaseUserId: true },
    });

    const invitation = await prisma.clubMember.upsert({
      where: { clubId_email: { clubId: club.id, email } },
      update: {
        role: "owner",
        ...(fan?.supabaseUserId
          ? { supabaseUserId: fan.supabaseUserId, joinedAt: new Date() }
          : {}),
      },
      create: {
        clubId: club.id,
        email,
        role: "owner",
        supabaseUserId: fan?.supabaseUserId ?? null,
        joinedAt: fan?.supabaseUserId ? new Date() : null,
      },
      select: { id: true, joinedAt: true },
    });

    console.log(
      invitation.joinedAt
        ? `Owner access granted for ${email} at ${club.name}.`
        : `Owner invitation created for ${email} at ${club.name}; it will activate after verified login.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
