"use client";

import { useEffect, useRef, useState } from "react";

type ScanOutcome = {
  result: "ok" | "already_used" | "expired" | "invalid" | "revoked";
  ticket?: {
    id: string;
    eventName: string;
    fanEmail: string;
    seatLabel: string | null;
    ticketTypeName: string;
  };
  detail?: string;
};

export default function GatePage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  if (!authed) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Gate access</h1>
          <p className="mt-2 text-sm text-zinc-400">Staff password required.</p>
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fetch("/api/gate/auth", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ password }),
              });
              if (res.ok) {
                setAuthed(true);
                setAuthError(null);
              } else {
                setAuthError("Wrong password");
              }
            }}
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              required
              className="w-full rounded-xl border border-border bg-surface-elev px-4 py-3 text-foreground outline-none focus:border-cyan-500"
            />
            {authError && <p className="text-sm text-red-400">{authError}</p>}
            <button className="w-full rounded-xl gradient-accent py-3 font-medium text-zinc-950">
              Unlock
            </button>
          </form>
        </div>
      </main>
    );
  }

  return <Scanner />;
}

function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [manualPayload, setManualPayload] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const inflightRef = useRef(false);
  const lastSeenRef = useRef<{ payload: string; ts: number } | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf: number | null = null;
    let cancelled = false;
    let detector: { detect: (s: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } | null =
      null;

    async function start() {
      try {
        if (!("BarcodeDetector" in window)) {
          setCameraError(
            "Camera scanning needs a browser with BarcodeDetector (mobile Chrome / Safari). Paste codes manually below.",
          );
          return;
        }
        const Detector = (window as unknown as {
          BarcodeDetector: new (opts: { formats: string[] }) => typeof detector & object;
        }).BarcodeDetector;
        detector = new Detector({ formats: ["qr_code"] }) as unknown as typeof detector;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScanning(true);
        const tick = async () => {
          if (cancelled || !videoRef.current || !detector) return;
          try {
            const results = await detector.detect(videoRef.current);
            for (const r of results) {
              if (!r.rawValue) continue;
              handleScan(r.rawValue);
            }
          } catch {
            // ignore individual frame errors
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        setCameraError((err as Error).message ?? "Camera unavailable");
      }
    }
    start();

    return () => {
      cancelled = true;
      if (raf !== null) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleScan(payload: string) {
    if (inflightRef.current) return;
    const last = lastSeenRef.current;
    if (last && last.payload === payload && Date.now() - last.ts < 2500) return;
    lastSeenRef.current = { payload, ts: Date.now() };
    inflightRef.current = true;
    try {
      const res = await fetch("/api/gate/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qrPayload: payload }),
      });
      const json = (await res.json()) as ScanOutcome;
      setOutcome(json);
    } finally {
      inflightRef.current = false;
    }
  }

  const bg =
    outcome?.result === "ok"
      ? "bg-emerald-500/20 border-emerald-500/50"
      : outcome
        ? "bg-red-500/20 border-red-500/50"
        : "bg-surface border-border";

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-6">
      <header className="w-full max-w-md">
        <h1 className="text-xl font-semibold">Gate scanner</h1>
        <p className="text-xs text-zinc-400">Single scan per ticket. Re-scans rejected.</p>
      </header>

      <div className="relative mt-4 w-full max-w-md overflow-hidden rounded-3xl border border-border bg-black">
        <video ref={videoRef} className="aspect-square w-full object-cover" playsInline muted />
        {!scanning && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            Starting camera…
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-zinc-300">
            {cameraError}
          </div>
        )}
      </div>

      <div
        className={`mt-4 w-full max-w-md rounded-3xl border p-5 transition-colors ${bg}`}
      >
        {outcome ? (
          <ResultCard outcome={outcome} />
        ) : (
          <p className="text-sm text-zinc-400">Awaiting first scan…</p>
        )}
      </div>

      <form
        className="mt-4 flex w-full max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!manualPayload) return;
          handleScan(manualPayload);
          setManualPayload("");
        }}
      >
        <input
          value={manualPayload}
          onChange={(e) => setManualPayload(e.target.value)}
          placeholder="Paste v1.<ticketId>.<token>"
          className="flex-1 rounded-xl border border-border bg-surface-elev px-3 py-2 text-sm outline-none focus:border-cyan-500"
        />
        <button className="rounded-xl gradient-accent px-4 py-2 text-sm font-medium text-zinc-950">
          Verify
        </button>
      </form>
    </main>
  );
}

function ResultCard({ outcome }: { outcome: ScanOutcome }) {
  const ok = outcome.result === "ok";
  return (
    <div>
      <p className="text-sm uppercase tracking-wide text-zinc-400">Result</p>
      <p
        className={`mt-1 text-2xl font-semibold ${ok ? "text-emerald-300" : "text-red-300"}`}
      >
        {outcome.result.replace("_", " ").toUpperCase()}
      </p>
      {outcome.ticket && (
        <dl className="mt-3 grid grid-cols-3 gap-1 text-sm">
          <dt className="text-zinc-400">Event</dt>
          <dd className="col-span-2">{outcome.ticket.eventName}</dd>
          <dt className="text-zinc-400">Type</dt>
          <dd className="col-span-2">{outcome.ticket.ticketTypeName}</dd>
          <dt className="text-zinc-400">Fan</dt>
          <dd className="col-span-2">{outcome.ticket.fanEmail}</dd>
          {outcome.ticket.seatLabel && (
            <>
              <dt className="text-zinc-400">Seat</dt>
              <dd className="col-span-2">{outcome.ticket.seatLabel}</dd>
            </>
          )}
        </dl>
      )}
      {outcome.detail && (
        <p className="mt-2 text-xs text-zinc-500">{outcome.detail}</p>
      )}
    </div>
  );
}
