import Link from "next/link";

export default function RecoveryErrorPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recovery link <span className="text-gradient-accent">expired</span>
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          This reset link is invalid, expired, or has already been used.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 block rounded-xl gradient-accent py-3 font-medium text-zinc-950"
        >
          Request another link
        </Link>
      </div>
    </main>
  );
}
