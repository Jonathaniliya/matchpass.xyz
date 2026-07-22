import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your <span className="text-gradient-accent">ticket.com</span>{" "}
          account
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Buy tickets with stablecoins. We&rsquo;ll spin up a wallet for you on
          your profile.
        </p>

        <SignupForm />

        <p className="mt-6 text-center text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="text-gradient-accent font-medium">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
