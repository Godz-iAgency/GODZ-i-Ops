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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-t-2xl border border-border bg-surface2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6"
        style={{ boxShadow: "var(--shadow-elevated)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-foreground">Delete this contact?</h3>
        <p className="text-base text-textSecondary mt-2 break-words">
          <span className="text-foreground font-semibold">{name || "Untitled"}</span> will be removed from Airtable.
          This can&rsquo;t be undone from here.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 min-[380px]:flex-row">
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
