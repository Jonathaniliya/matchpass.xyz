"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type Balance = { symbol: string; amount: string };

type Props = {
  fan: {
    displayName: string | null;
    email: string;
    preferredCurrency: string;
  };
};

export function HeaderAccount({ fan }: Props) {
  const [open, setOpen] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
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

  const displayLabel =
    showBalance && balanceLabel
      ? balanceLabel
      : (fan.displayName ?? fan.email);

  return (
    <div ref={dropdownRef} className="relative flex items-center gap-1">
      {/* Balance / identity toggle */}
      {balanceLabel && (
        <button
          type="button"
          aria-label={showBalance ? "Show name" : "Show balance"}
          onClick={() => setShowBalance((v) => !v)}
          className="hidden rounded-full border border-border p-1.5 text-zinc-400 hover:bg-surface-elev sm:inline-flex"
          title={showBalance ? "Show name" : "Show balance"}
        >
          {showBalance ? (
            /* person icon */
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          ) : (
            /* wallet icon */
            <svg
              className="h-3.5 w-3.5"
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
        </button>
      )}

      {/* Main button — opens dropdown */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-surface-elev sm:inline-flex"
      >
        <span className="max-w-[140px] truncate">{displayLabel}</span>
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
        <div className="absolute right-0 top-full z-50 mt-2 w-76 rounded-2xl border border-border bg-surface p-5 shadow-2xl">
          {/* Email */}
          <div className="mb-4">
            <p className="mb-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
              Account
            </p>
            <p className="break-all text-sm font-medium text-zinc-200">
              {fan.email}
            </p>
          </div>

          {/* Balances */}
          {balances.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                Balance
              </p>
              <div className="space-y-0.5">
                {balances.map((b) => (
                  <p key={b.symbol} className="text-sm font-semibold text-foreground">
                    {parseFloat(b.amount).toFixed(2)}{" "}
                    <span className="font-normal text-zinc-400">{b.symbol}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Preferred currency */}
          <div className="mb-4">
            <p className="mb-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
              Preferred currency
            </p>
            <p className="text-xs text-zinc-300">{fan.preferredCurrency}</p>
          </div>

          <div className="border-t border-border pt-3">
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
