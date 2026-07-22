"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type WalletProp = {
  address: string;
  chain: string;
} | null;

const APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;

function truncate(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletProvisioner({ wallet }: { wallet: WalletProp }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    if (!APP_ID) {
      setError("Wallet not configured: NEXT_PUBLIC_CIRCLE_APP_ID is missing.");
      return;
    }
    setBusy(true);
    try {
      const initRes = await fetch("/api/wallet/init", { method: "POST" });
      if (!initRes.ok) {
        const j = await initRes.json().catch(() => ({}));
        throw new Error(j.error ?? "init_failed");
      }
      const { userToken, encryptionKey, challengeId } = (await initRes.json()) as {
        userToken: string;
        encryptionKey: string;
        challengeId: string;
      };

      // Dynamic import keeps the Web3Services SDK out of the SSR bundle.
      const mod = await import("@circle-fin/w3s-pw-web-sdk");
      const W3SSdk = (mod as { W3SSdk: new () => unknown }).W3SSdk;
      const sdk = new W3SSdk() as {
        setAppSettings: (s: { appId: string }) => void;
        setAuthentication: (a: { userToken: string; encryptionKey: string }) => void;
        execute: (
          id: string,
          cb: (
            error: { code?: string; message?: string } | undefined,
            result: { type?: string; status?: string } | undefined,
          ) => void,
        ) => void;
      };
      sdk.setAppSettings({ appId: APP_ID });
      sdk.setAuthentication({ userToken, encryptionKey });

      sdk.execute(challengeId, async (err, result) => {
        if (err) {
          setError(err.message ?? "PIN challenge failed");
          setBusy(false);
          return;
        }
        if (result?.status !== "COMPLETE" && result?.status !== "COMPLETED") {
          setError(`Challenge ended: ${result?.status ?? "unknown"}`);
          setBusy(false);
          return;
        }
        try {
          const syncRes = await fetch("/api/wallet/sync", { method: "POST" });
          if (!syncRes.ok) {
            const j = await syncRes.json().catch(() => ({}));
            throw new Error(j.error ?? "sync_failed");
          }
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "sync_failed");
        } finally {
          setBusy(false);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "wallet_init_failed");
      setBusy(false);
    }
  }

  if (wallet) {
    return (
      <div className="space-y-1 text-sm text-zinc-200">
        <p>
          <span className="text-zinc-500">Address:</span>{" "}
          <span className="font-mono">{truncate(wallet.address)}</span>
        </p>
        <p>
          <span className="text-zinc-500">Chain:</span> {wallet.chain}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Funds sent to this address can be used to pay for tickets directly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        Set up your stablecoin wallet with a 6-digit PIN. The wallet is yours —
        we never see your PIN.
      </p>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="rounded-xl gradient-accent px-5 py-3 text-sm font-medium text-zinc-950 disabled:opacity-60"
      >
        {busy ? "Setting up…" : "Set up your wallet"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
