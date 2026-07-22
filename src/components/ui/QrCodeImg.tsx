"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCodeImg({ value, size = 256 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      margin: 1,
      width: size,
      color: { dark: "#0a0a0b", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className="rounded-xl bg-zinc-800"
        style={{ width: size, height: size }}
        aria-label="Generating QR"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="QR code"
      width={size}
      height={size}
      className="rounded-xl bg-white p-2"
    />
  );
}
