"use client";

import { useState } from "react";

interface Props {
  jobId: string;
  userId: string | null;
}

export function CommentForm({ jobId, userId }: Props) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!userId) {
    return (
      <p className="text-sm text-muted">
        <a
          href="https://farmcash.app/login/?login=true&next=https://farmcash.app/jobs/auth/callback"
          className="text-primary hover:underline"
        >
          Sign in
        </a>{" "}
        to leave a comment.
      </p>
    );
  }

  if (status === "success") {
    return (
      <p className="text-sm text-muted">
        Thanks! Your comment will appear once approved.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length < 10) {
      setErrorMsg("Comment must be at least 10 characters.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/jobs/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, content }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Something went wrong");
      }
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("idle");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share your experience with this offer…"
        rows={3}
        maxLength={1000}
        className="w-full rounded-xl border border-border bg-bg text-fg text-sm p-3 resize-none focus:outline-none focus:border-primary/60 placeholder:text-muted"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{content.length}/1000</span>
        {errorMsg && <p className="text-sm text-red-500 flex-1">{errorMsg}</p>}
        <button
          type="submit"
          disabled={status === "loading" || content.trim().length < 10}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50 transition-opacity shrink-0"
        >
          {status === "loading" ? "Sending…" : "Post Comment"}
        </button>
      </div>
    </form>
  );
}
