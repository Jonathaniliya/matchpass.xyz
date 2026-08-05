"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { WalletQuickTransfer } from "@/components/wallet/WalletQuickTransfer";

type Balance = { symbol: string; amount: string };

type Props = {
  fan: {
    displayName: string | null;
    avatarUrl: string | null;
    email: string;
    preferredCurrency: string;
  };
};

export function HeaderAccount({ fan }: Props) {
  const [open, setOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletChain, setWalletChain] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  // Fetch balance on mount
  useEffect(() => {
    fetch("/api/wallet/balance")
      .then((r) => r.json())
      .then((d) => {
        setBalances(d.balances ?? []);
        if (d.address) setWalletAddress(d.address);
        if (d.chain) setWalletChain(d.chain);
      })
      .catch(() => {})
      .finally(() => setLoadingBalance(false));
  }, []);

  const preferredBalance =
    balances.find((b) => b.symbol === fan.preferredCurrency) ?? balances[0];

  const balanceLabel = loadingBalance
    ? "…"
    : preferredBalance
      ? `${parseFloat(preferredBalance.amount).toFixed(2)} ${preferredBalance.symbol}`
      : walletAddress
        ? `0.00 ${fan.preferredCurrency}`
        : null;

  const displayLabel = balanceLabel ?? fan.displayName ?? fan.email;

  return (
    <div ref={dropdownRef} className="relative flex items-center gap-1">
      {/* Single wallet/account control — balance when a UCW exists. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-surface-elev sm:px-3"
      >
        {walletAddress && (
          <svg
            className="h-3.5 w-3.5 shrink-0 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        )}
        <span className="max-w-[105px] truncate sm:max-w-[140px]">
          {displayLabel}
        </span>
        <svg
          className={`h-3 w-3 shrink-0 text-zinc-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-96 rounded-2xl border border-border bg-surface p-5 shadow-2xl sm:w-96">
          {/* Email */}
          <div className="mb-4 flex items-center gap-3">
            <ProfileAvatar
              avatarUrl={fan.avatarUrl}
              displayName={fan.displayName}
              email={fan.email}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-200">
                {fan.displayName ?? fan.email}
              </p>
              {fan.displayName && (
                <p className="truncate text-xs text-zinc-500">{fan.email}</p>
              )}
            </div>
          </div>

          {/* Wallet balance */}
          {walletAddress && (
            <div className="mb-4">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                Wallet balance
              </p>
              <p className="text-lg font-semibold text-foreground">
                {preferredBalance
                  ? parseFloat(preferredBalance.amount).toFixed(2)
                  : "0.00"}{" "}
                <span className="text-sm font-normal text-zinc-400">USDC</span>
              </p>
            </div>
          )}

          {/* UCW deposit address */}
          {walletAddress && (
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                  MatchPass wallet deposit address
                </p>
                {walletChain && (
                  <span className="text-[10px] text-zinc-600">
                    {walletChain.replace("-TESTNET", " Testnet")}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-border bg-surface-elev px-2.5 py-2 font-mono text-[11px] text-zinc-300">
                  {walletAddress}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(walletAddress);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1_500);
                  }}
                  className="rounded-lg border border-border bg-surface-elev px-2.5 py-2 text-[11px] text-zinc-200"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {walletAddress && <WalletQuickTransfer />}

          <div className="border-t border-border pt-3">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-300 transition hover:bg-surface-elev"
            >
              <svg
                className="h-4 w-4 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 5a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm9 0a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm9 0a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1v-5z"
                />
              </svg>
              Fan dashboard
            </Link>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-300 transition hover:bg-surface-elev"
            >
              <svg
                className="h-4 w-4 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Account settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
