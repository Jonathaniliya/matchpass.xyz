"use client";

import { useState } from "react";
import { executeCircleChallenge } from "@/lib/client/circleWallet";

type TransferChallenge = {
  attemptId: string;
  challengeId: string;
  userToken: string;
  encryptionKey: string;
};

export function WalletQuickTransfer() {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send() {
    if (!confirmed || busy) return;
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
        throw new Error(walletTransferMessage(body.error, body.details));
      }
      challenge = body as TransferChallenge;
      await executeCircleChallenge(challenge);
      await updateChallengeStatus(challenge.attemptId, "COMPLETE");
      setDestination("");
      setAmount("");
      setConfirmed(false);
      setNotice("Transfer submitted. The balance will update after Arc confirms it.");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not submit transfer.";
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

  return (
    <div className="mb-4 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setError(null);
          setNotice(null);
        }}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-elev px-3 py-2.5 text-sm text-foreground"
      >
        <span>Send USDC</span>
        <span className="text-xs text-cyan-300">{open ? "Close" : "Open"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-500">
              Transfer address
            </span>
            <input
              required
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              pattern="0x[a-fA-F0-9]{40}"
              placeholder="0x…"
              autoComplete="off"
              className="w-full rounded-xl border border-border bg-surface-elev px-3 py-2.5 font-mono text-xs text-foreground outline-none focus:border-cyan-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-500">
              Amount
            </span>
            <div className="relative">
              <input
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                pattern="[0-9]+([.][0-9]{1,6})?"
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-surface-elev px-3 py-2.5 pr-14 font-mono text-xs text-foreground outline-none focus:border-cyan-500"
              />
              <span className="absolute inset-y-0 right-3 flex items-center text-[10px] text-zinc-500">
                USDC
              </span>
            </div>
          </label>
          <label className="flex items-start gap-2 text-[11px] leading-5 text-zinc-400">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-cyan-400"
            />
            I checked the address, amount, and Arc network. A network fee applies.
          </label>
          <button
            type="button"
            onClick={() => void send()}
            disabled={
              !confirmed ||
              busy ||
              !/^0x[a-fA-F0-9]{40}$/.test(destination.trim()) ||
              !/^[0-9]+([.][0-9]{1,6})?$/.test(amount.trim())
            }
            className="w-full rounded-xl gradient-accent px-4 py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            {busy ? "Opening PIN…" : "Confirm with PIN"}
          </button>
          {notice && <p className="text-xs leading-5 text-emerald-300">{notice}</p>}
          {error && <p className="text-xs leading-5 text-red-300">{error}</p>}
        </div>
      )}
    </div>
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

function walletTransferMessage(
  code: unknown,
  details?: Record<string, string>,
) {
  const messages: Record<string, string> = {
    insufficient_usdc_balance: `Insufficient USDC. Available: ${details?.available ?? "0"}.`,
    insufficient_usdc_for_amount_and_fee: `Leave enough USDC for the network fee. Required: ${details?.required ?? "unknown"}.`,
    destination_is_your_wallet: "Choose a different destination address.",
    invalid_transfer: "Check the transfer address and amount.",
    transfer_challenge_failed: "Circle could not create the transfer challenge.",
  };
  return typeof code === "string"
    ? (messages[code] ?? code.replaceAll("_", " "))
    : "Could not submit transfer.";
}
