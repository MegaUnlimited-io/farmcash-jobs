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

function ApprovedRow({ comment }: { comment: PendingComment }) {
  const [isPinned, setIsPinned] = useState(comment.is_pinned);
  const [isGuide, setIsGuide] = useState(comment.is_guide);
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (field: "is_pinned" | "is_guide") => {
    const current = field === "is_pinned" ? isPinned : isGuide;
    setBusy(field);
    try {
      const res = await fetch("/jobs/api/admin/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: comment.id, field, value: !current }),
      });
      if (res.ok) {
        if (field === "is_pinned") setIsPinned(!current);
        else setIsGuide(!current);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`p-4 rounded-xl border bg-card space-y-2 ${isGuide ? "border-green-500/30" : "border-border"}`}>
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
            onClick={() => toggle("is_pinned")}
            disabled={busy !== null}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
              isPinned ? "bg-primary/15 text-primary" : "bg-border text-muted hover:text-fg"
            }`}
          >
            {isPinned ? "📌 Pinned" : "Pin"}
          </button>
          <button
            onClick={() => toggle("is_guide")}
            disabled={busy !== null}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
              isGuide ? "bg-green-500/15 text-green-500" : "bg-border text-muted hover:text-fg"
            }`}
          >
            {isGuide ? "📖 Guide" : "Guide"}
          </button>
        </div>
      </div>
      <p className="text-sm text-muted leading-relaxed">{comment.content}</p>
    </div>
  );
}

export function ApprovedCommentsList({ comments }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? comments : comments.slice(0, 5);

  if (comments.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Approved Comments
        </h2>
        <span className="text-xs text-muted">{comments.length} recent</span>
      </div>
      <div className="space-y-3">
        {visible.map((comment) => (
          <ApprovedRow key={comment.id} comment={comment} />
        ))}
      </div>
      {comments.length > 5 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 text-xs text-muted hover:text-fg transition-colors w-full text-center"
        >
          {expanded ? "Show less" : `Show all ${comments.length}`}
        </button>
      )}
    </section>
  );
}
