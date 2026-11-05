"use client";

import React, { useEffect } from "react";

export type BottomToastType = "success" | "info" | "danger" | "error";

interface BottomToastProps {
  open: boolean;
  message: string;
  type?: BottomToastType;
  duration?: number;
  onClose: () => void;
}

export default function BottomToast({
  open,
  message,
  type = "success",
  duration = 3200,
  onClose,
}: BottomToastProps) {
  useEffect(() => {
    if (!open || !message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [open, message, duration, onClose]);

  if (!open || !message) return null;

  const isDanger = type === "danger" || type === "error";
  const isInfo = type === "info";

  return (
    <div
      className="fintrack-bottom-toast"
      role="status"
      aria-live="polite"
      onClick={onClose}
    >
      <i
        className={
          isDanger
            ? "bi bi-exclamation-circle-fill"
            : isInfo
            ? "bi bi-info-circle-fill"
            : "bi bi-check-circle-fill"
        }
        style={{
          color: isDanger ? "#dc2626" : isInfo ? "#1d4ed8" : "#1a2e23",
          fontSize: "1.02rem",
          lineHeight: 1,
          flexShrink: 0,
        }}
      />

      <span
        style={{
          fontSize: "0.84rem",
          fontWeight: 500,
          color: "#1a2e23",
          lineHeight: 1.4,
        }}
      >
        {message}
      </span>
    </div>
  );
}
