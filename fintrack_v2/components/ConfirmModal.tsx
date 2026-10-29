"use client";

import React from "react";
import { Modal, Button } from "antd";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  icon?: React.ReactNode;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  icon,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const isDanger = variant === "danger";

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      centered
      width={440}
      className="fintrack-modal"
      destroyOnHidden
    >
      <div className="d-flex flex-column">
        <div className="d-flex align-items-center gap-3 mb-2">
          {icon && (
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 40,
                height: 40,
                backgroundColor: isDanger ? "#fee2e2" : "#e8f3ec",
                color: isDanger ? "#e11d48" : "#4a7d5e",
                fontSize: "1.05rem",
              }}
            >
              {icon}
            </div>
          )}
          <h3
            className="mb-0"
            style={{
              fontSize: "1.15rem",
              fontWeight: 600,
              color: "#1a2e23",
            }}
          >
            {title}
          </h3>
        </div>

        <div
          className="text-secondary mt-2 mb-4"
          style={{ fontSize: "0.85rem", lineHeight: 1.55 }}
        >
          {description}
        </div>

        <div className="d-flex justify-content-end gap-2">
          <Button
            className="fintrack-modal-cancel-btn"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            className={
              isDanger
                ? "fintrack-modal-danger-btn"
                : "fintrack-modal-primary-btn"
            }
            loading={loading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
