/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal.js";
import { Button } from "./Button.js";

interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  loading?: boolean;
  isRtl?: boolean;
}

// Shared confirmation dialog - replaces every window.confirm("...") call in the app (campaign
// deletion, review/property/lead deletion in the admin panel, etc.). window.confirm blocks the
// JS thread, can't be styled or localized properly, and its exact wording/behavior differs by
// browser - this matches the rest of the app's UI instead of breaking out to a native dialog.
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  loading = false,
  isRtl = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} size="sm" isRtl={isRtl}>
      <div className="flex flex-col items-center text-center gap-3">
        {tone === "danger" && (
          <div className="w-11 h-11 rounded-full bg-danger-soft text-danger flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        )}
        <h3 className="font-serif text-lg font-semibold text-ink text-balance">{title}</h3>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
        <div className="flex gap-2 w-full mt-3">
          <Button variant="secondary" fullWidth onClick={onCancel} disabled={loading}>
            {cancelLabel || (isRtl ? "إلغاء" : "Cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            fullWidth
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel || (isRtl ? "تأكيد" : "Confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
