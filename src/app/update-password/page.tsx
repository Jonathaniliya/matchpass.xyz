import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/server/auth/supabaseServer";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/forgot-password");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose a <span className="text-gradient-accent">new password</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Set a new password for {user.email ?? "your account"}.
        </p>
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
