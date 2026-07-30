"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { executeCircleChallenge } from "@/lib/client/circleWallet";

type WalletProp = {
  address: string;
  chain: string;
} | null;

type WalletBalance = {
  symbol: "USDC";
  amount: string;
};

type TransferChallenge = {
  attemptId: string;
  challengeId: string;
  userToken: string;
  encryptionKey: string;
};

export function WalletProvisioner({ wallet }: { wallet: WalletProp }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(Boolean(wallet));
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!wallet) return;
    void refreshBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.address]);

  async function refreshBalance() {
    setBalanceLoading(true);
    try {
      const response = await fetch("/api/wallet/balance", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(walletErrorMessage(body.error));
      setBalance(body.usdc ?? { symbol: "USDC", amount: "0" });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load wallet balance.",
      );
    } finally {
      setBalanceLoading(false);
    }
  }

  async function startWalletSetup() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const initRes = await fetch("/api/wallet/init", { method: "POST" });
      const init = await initRes.json().catch(() => ({}));
      if (!initRes.ok) throw new Error(walletErrorMessage(init.error));
      if (init.wallet) {
        router.refresh();
        return;
      }
      if (!init.userToken || !init.encryptionKey || !init.challengeId) {
        throw new Error("Wallet challenge is unavailable. Try again shortly.");
      }

      await executeCircleChallenge(init);
      await syncWalletWithRetry();
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not set up the wallet.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    let challenge: TransferChallenge | null = null;
    try {
      const response = await fetch("/api/wallet/transfers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purpose: "withdrawal",
          destinationAddress: destination.trim(),
          amount: amount.trim(),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(walletErrorMessage(body.error, body.details));
      }
      challenge = body as TransferChallenge;

      await executeCircleChallenge(challenge);
      await updateChallengeStatus(challenge.attemptId, "COMPLETE");
      setNotice(
        "Transfer authorized and submitted to Circle. It may take a moment to confirm on Arc.",
      );
      setDestination("");
      setAmount("");
      setReviewing(false);
      setConfirmed(false);
      window.setTimeout(() => void refreshBalance(), 4_000);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not submit the transfer.";
      if (challenge) {
        await updateChallengeStatus(challenge.attemptId, "FAILED", message).catch(
          () => undefined,
        );
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  if (!wallet) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-6 text-zinc-400">
          Set up a personal USDC wallet with a 6-digit PIN. You can fund it and
          pay for tickets from its balance, or keep paying from any supported
          external wallet. MatchPass never sees your PIN.
        </p>
        <button
          type="button"
          onClick={startWalletSetup}
          disabled={busy}
          className="rounded-xl gradient-accent px-5 py-3 text-sm font-medium text-zinc-950 disabled:opacity-60"
        >
          {busy ? "Setting up…" : "Set up your wallet"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Available balance
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-zinc-100">
              {balanceLoading
                ? "Loading…"
                : `${Number(balance?.amount ?? 0).toFixed(2)} USDC`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshBalance()}
            disabled={balanceLoading}
            className="rounded-lg border border-border px-3 py-2 text-xs text-zinc-300 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Your deposit address
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-border bg-surface-elev px-3 py-2 font-mono text-xs text-zinc-200">
            {wallet.address}
          </code>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(wallet.address);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1_500);
            }}
            className="rounded-lg border border-border bg-surface-elev px-3 py-2 text-xs"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Send only USDC on Arc Testnet to this address. Deposits appear after
          the network confirms them.
        </p>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="text-sm font-medium text-zinc-200">Send USDC</h3>
        {!reviewing ? (
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setNotice(null);
              setConfirmed(false);
              setReviewing(true);
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">
                Destination address
              </span>
              <input
                required
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                pattern="0x[a-fA-F0-9]{40}"
                placeholder="0x…"
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-surface-elev px-4 py-3 font-mono text-sm outline-none focus:border-cyan-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">Amount</span>
              <div className="relative">
                <input
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  pattern="[0-9]+([.][0-9]{1,6})?"
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border bg-surface-elev px-4 py-3 pr-16 font-mono text-sm outline-none focus:border-cyan-500"
                />
                <span className="absolute inset-y-0 right-4 flex items-center text-xs text-zinc-500">
                  USDC
                </span>
              </div>
            </label>
            <button
              type="submit"
              className="rounded-xl border border-cyan-800/70 bg-cyan-950/30 px-5 py-3 text-sm font-medium text-cyan-200"
            >
              Review transfer
            </button>
          </form>
        ) : (
          <div className="mt-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-yellow-300">
              Confirm transfer
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Amount</dt>
                <dd className="font-mono text-zinc-100">{amount} USDC</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Network</dt>
                <dd className="text-zinc-200">Arc Testnet</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Destination</dt>
                <dd className="mt-1 break-all font-mono text-xs text-zinc-200">
                  {destination}
                </dd>
              </div>
            </dl>
            <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-zinc-300">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 h-4 w-4 accent-cyan-400"
              />
              I checked the address, token, network, and amount. I understand
              blockchain transfers are irreversible and a network fee applies.
            </label>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => void send()}
                disabled={!confirmed || busy}
                className="rounded-xl gradient-accent px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
              >
                {busy ? "Opening PIN…" : "Confirm with PIN"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReviewing(false);
                  setConfirmed(false);
                }}
                disabled={busy}
                className="rounded-xl border border-border px-4 py-2 text-sm text-zinc-300"
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>

      {notice && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {notice}
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

async function updateChallengeStatus(
  attemptId: string,
  status: "COMPLETE" | "FAILED" | "EXPIRED",
  error?: string,
) {
  await fetch(`/api/wallet/transfers/${attemptId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, error }),
  });
}

async function syncWalletWithRetry() {
  const delays = [0, 1_000, 2_000, 3_000, 5_000, 8_000, 10_000, 12_000];
  let lastError = "wallet_sync_failed";

  for (const delay of delays) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    const response = await fetch("/api/wallet/sync", { method: "POST" });
    if (response.ok) return;

    const body = await response.json().catch(() => ({}));
    lastError = typeof body.error === "string" ? body.error : lastError;
    if (!isRetryableSyncStatus(response.status)) break;
  }

  throw new Error(
    lastError === "no_wallet_yet"
      ? "Your wallet was created, but Circle is still syncing it. MatchPass will reconnect it automatically when you return to Profile."
      : "Your wallet was created, but MatchPass could not save it yet. It will retry automatically when you return to Profile.",
  );
}

function isRetryableSyncStatus(status: number) {
  return (
    status === 404 ||
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function walletErrorMessage(
  code: unknown,
  details?: Record<string, string>,
) {
  const messages: Record<string, string> = {
    wallet_not_setup: "Set up your MatchPass wallet first.",
    wallet_balance_unavailable: "Could not load the wallet balance. Try again.",
    usdc_balance_unavailable: "Circle has not indexed USDC for this wallet yet.",
    insufficient_usdc_balance: `Insufficient USDC. Available: ${details?.available ?? "0"} USDC.`,
    insufficient_usdc_for_amount_and_fee: `Leave enough USDC for the Arc network fee. Required: ${details?.required ?? "unknown"} USDC.`,
    destination_is_your_wallet: "Choose a different destination address.",
    invalid_transfer: "Check the destination address and amount.",
    transfer_challenge_failed: "Circle could not create this transfer. Try again.",
    circle_credentials_unavailable: "Circle could not authenticate this wallet. Try again.",
    wallet_init_failed: "Circle could not start wallet setup. Try again.",
  };
  return typeof code === "string"
    ? (messages[code] ?? code.replaceAll("_", " "))
    : "Wallet request failed. Try again.";
}
