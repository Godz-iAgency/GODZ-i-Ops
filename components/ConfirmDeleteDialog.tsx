"use client";

import { Trash2 } from "lucide-react";

// One extra click between a stray tap and a permanent delete. Sits above the
// detail modal (z-50) so it can be opened from either the card or the modal.
export default function ConfirmDeleteDialog({
  name,
  busy,
  onConfirm,
  onCancel,
}: {
  name: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-[60] bg-black/80" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 bg-surface2 border border-border"
        style={{ boxShadow: "var(--shadow-elevated)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-foreground">Delete this contact?</h3>
        <p className="text-base text-textSecondary mt-2 break-words">
          <span className="text-foreground font-semibold">{name || "Untitled"}</span> will be removed from Airtable.
          This can&rsquo;t be undone from here.
        </p>
        <div className="flex gap-2.5 mt-6">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 rounded-xl text-base font-semibold bg-surface3 border border-border text-textSecondary hover:text-white transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-3 rounded-xl text-base font-bold flex items-center justify-center gap-2 text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
          >
            <Trash2 size={16} /> {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
