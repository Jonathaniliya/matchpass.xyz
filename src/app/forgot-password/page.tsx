import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Reset your <span className="text-gradient-accent">password</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          We&rsquo;ll email you a secure, time-limited recovery link.
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
