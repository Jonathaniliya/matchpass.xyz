import Link from "next/link";

export default function OAuthErrorPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Social sign-in <span className="text-gradient-accent">failed</span>
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          The provider did not complete authentication. Try again or continue
          with email.
        </p>
        <Link
          href="/login"
          className="mt-6 block rounded-xl gradient-accent py-3 font-medium text-zinc-950"
        >
          Return to login
        </Link>
      </div>
    </main>
  );
}
