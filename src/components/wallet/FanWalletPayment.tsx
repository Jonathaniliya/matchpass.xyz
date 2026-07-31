"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { executeCircleChallenge } from "@/lib/client/circleWallet";

type Props = {
  orderId: string;
  amountUsdc: string;
  disabled: boolean;
};

type TransferChallenge = {
  attemptId: string;
  challengeId: string;
  userToken: string;
  encryptionKey: string;
};

export function FanWalletPayment({ orderId, amountUsdc, disabled }: Props) {
  const [available, setAvailable] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/wallet/balance", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return null;
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error("Could not load your wallet balance.");
        return body;
      })
      .then((body) => {
        if (!alive || !body) return;
        setVisible(true);
        setHasWallet(Boolean(body.address));
        setAvailable(body.usdc?.amount ?? "0");
      })
      .catch((caught) => {
        if (!alive) return;
        setVisible(true);
        setError(caught instanceof Error ? caught.message : "Wallet unavailable.");
      });
    return () => {
      alive = false;
    };
  }, []);

  async function pay() {
    if (!confirmed || disabled) return;
    setBusy(true);
    setError(null);
    let challenge: TransferChallenge | null = null;
    try {
      const response = await fetch("/api/wallet/transfers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "order_payment", orderId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(paymentErrorMessage(body.error, body.details));
      challenge = body as TransferChallenge;

      await executeCircleChallenge(challenge);
      await updateChallengeStatus(challenge.attemptId, "COMPLETE");
      setSubmitted(true);
      setReviewing(false);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not submit payment.";
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

  if (!visible) return null;

  if (!hasWallet) {
    return (
      <section className="mt-6 rounded-2xl border border-cyan-900/60 bg-cyan-950/20 p-5">
        <p className="text-sm font-medium text-cyan-100">Pay from MatchPass wallet</p>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          Fund a personal USDC wallet once, then approve ticket payments with
          your PIN.
        </p>
        <Link
          href="/profile"
          className="mt-3 inline-block text-sm font-medium text-cyan-300"
        >
          Set up wallet →
        </Link>
      </section>
    );
  }

  const enough = Number(available ?? 0) >= Number(amountUsdc);

  return (
    <section className="mt-6 rounded-2xl border border-cyan-900/60 bg-cyan-950/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-cyan-100">
            Pay from MatchPass wallet
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Available: {Number(available ?? 0).toFixed(2)} USDC
          </p>
        </div>
        {!reviewing && !submitted && (
          <button
            type="button"
            onClick={() => {
              setConfirmed(false);
              setReviewing(true);
            }}
            disabled={disabled || !enough}
            className="shrink-0 rounded-xl gradient-accent px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            Pay with wallet
          </button>
        )}
      </div>

      {!enough && !submitted && (
        <p className="mt-3 text-xs leading-5 text-yellow-300">
          Deposit more USDC before paying. Keep a small amount available for the
          Arc network fee, or use another wallet below.
        </p>
      )}

      {reviewing && (
        <div className="mt-4 border-t border-cyan-900/50 pt-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Amount</dt>
              <dd className="font-mono text-zinc-100">{amountUsdc} USDC</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Network</dt>
              <dd className="text-zinc-200">Arc Testnet</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">For</dt>
              <dd className="text-right text-zinc-200">This ticket order</dd>
            </div>
          </dl>
          <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-zinc-300">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 accent-cyan-400"
            />
            I confirm the USDC amount and Arc network. This transfer is
            irreversible and includes a network fee.
          </label>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => void pay()}
              disabled={!confirmed || busy || disabled}
              className="rounded-xl gradient-accent px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
            >
              {busy ? "Opening PIN…" : "Confirm with PIN"}
            </button>
            <button
              type="button"
              onClick={() => setReviewing(false)}
              disabled={busy}
              className="rounded-xl border border-border px-4 py-2 text-sm text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {submitted && (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-200">
          Payment submitted. Waiting for Circle’s on-chain confirmation before
          issuing your tickets…
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  );
}

async function updateChallengeStatus(
  attemptId: string,
  status: "COMPLETE" | "FAILED",
  error?: string,
) {
  await fetch(`/api/wallet/transfers/${attemptId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, error }),
  });
}

function paymentErrorMessage(
  code: unknown,
  details?: Record<string, string>,
) {
  const messages: Record<string, string> = {
    wallet_not_setup: "Set up your MatchPass wallet first.",
    order_not_found: "This order is not available for your account.",
    order_not_pending: "This order is no longer waiting for payment.",
    order_expired: "This order expired. Start a new order.",
    insufficient_usdc_balance: `Insufficient USDC. Available: ${details?.available ?? "0"} USDC.`,
    insufficient_usdc_for_amount_and_fee: `Leave enough USDC for the Arc network fee. Required: ${details?.required ?? "unknown"} USDC.`,
    usdc_balance_unavailable: "Circle has not indexed USDC for this wallet yet.",
    transfer_challenge_failed: "Circle could not create this payment. Try again.",
    wallet_payments_not_deployed:
      "Wallet payments are temporarily unavailable while the database update is deployed. You can still pay from another wallet below.",
  };
  return typeof code === "string"
    ? (messages[code] ?? code.replaceAll("_", " "))
    : "Could not submit payment.";
}
