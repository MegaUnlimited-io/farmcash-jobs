"use client";

import { useState } from "react";
import Link from "next/link";
import type { PendingComment } from "@/lib/types";

interface Props {
  comments: PendingComment[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Flag toggle button ────────────────────────────────────────────────────────

interface FlagButtonProps {
  commentId: string;
  field: "is_pinned" | "is_guide";
  active: boolean;
  onToggle: (field: "is_pinned" | "is_guide", value: boolean) => void;
}

function FlagButton({ commentId, field, active, onToggle }: FlagButtonProps) {
  const [busy, setBusy] = useState(false);
  const label = field === "is_pinned" ? "Pin" : "Guide";

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch("/jobs/api/admin/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: commentId, field, value: !active }),
      });
      if (res.ok) onToggle(field, !active);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
        active
          ? field === "is_pinned"
            ? "bg-primary/15 text-primary"
            : "bg-green-500/15 text-green-500"
          : "bg-border text-muted hover:text-fg"
      }`}
    >
      {field === "is_pinned" ? (active ? "📌 Pinned" : "Pin") : (active ? "📖 Guide" : "Guide")}
    </button>
  );
}

// ── Comment row ───────────────────────────────────────────────────────────────

function CommentRow({ comment }: { comment: PendingComment }) {
  const [state, setState] = useState<"idle" | "loading" | "approved" | "rejected">("idle");
  const [isPinned, setIsPinned] = useState(comment.is_pinned);
  const [isGuide, setIsGuide] = useState(comment.is_guide);

  const moderate = async (action: "approved" | "rejected") => {
    setState("loading");
    try {
      const res = await fetch("/jobs/api/admin/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: comment.id, status: action }),
      });
      if (!res.ok) throw new Error();
      setState(action);
    } catch {
      setState("idle");
    }
  };

  const handleFlag = (field: "is_pinned" | "is_guide", value: boolean) => {
    if (field === "is_pinned") setIsPinned(value);
    else setIsGuide(value);
  };

  if (state === "approved") {
    return (
      <div className="p-4 rounded-xl border border-primary/20 bg-card space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/jobs/${comment.job_slug}`}
              target="_blank"
              className="text-xs font-semibold text-primary hover:underline"
            >
              {comment.job_name}
            </Link>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-primary font-medium">✓ Approved</span>
              <span className="text-xs text-muted">{formatDate(comment.created_at)}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <FlagButton commentId={comment.id} field="is_pinned" active={isPinned} onToggle={handleFlag} />
            <FlagButton commentId={comment.id} field="is_guide" active={isGuide} onToggle={handleFlag} />
          </div>
        </div>
        <p className="text-sm text-fg leading-relaxed">{comment.content}</p>
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div className="px-4 py-3 rounded-xl border border-border bg-card/50 flex items-center gap-2 opacity-60">
        <span className="text-xs text-muted font-medium">✗ Rejected</span>
        <span className="text-xs text-muted truncate">— {comment.content.slice(0, 60)}</span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/jobs/${comment.job_slug}`}
            target="_blank"
            className="text-xs font-semibold text-primary hover:underline"
          >
            {comment.job_name}
          </Link>
          <p className="text-xs text-muted mt-0.5">{formatDate(comment.created_at)}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => moderate("approved")}
            disabled={state === "loading"}
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => moderate("rejected")}
            disabled={state === "loading"}
            className="px-3 py-1.5 rounded-lg bg-border text-muted text-xs font-medium hover:bg-border/70 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
      <p className="text-sm text-fg leading-relaxed">{comment.content}</p>
    </div>
  );
}

export function ModerationList({ comments }: Props) {
  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <CommentRow key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
