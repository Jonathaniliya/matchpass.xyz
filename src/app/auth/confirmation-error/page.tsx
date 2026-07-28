import Link from "next/link";

export default function ConfirmationErrorPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center">
        <h1 className="text-2xl font-semibold">Confirmation link unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          This link is invalid, expired, or has already been used. Try signing in;
          if the account is not confirmed, request a new signup email.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm text-gradient-accent">
          Return to login
        </Link>
      </div>
    </main>
  );
}
