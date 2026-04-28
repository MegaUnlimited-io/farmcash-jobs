import { getApprovedComments } from "@/lib/db/comments";
import type { JobComment } from "@/lib/types";

interface Props {
  jobId: string;
}

function displayName(comment: JobComment): string {
  if (comment.is_bot && comment.bot_name) return comment.bot_name;
  return comment.user_id ? `User ${comment.user_id.slice(0, 6)}` : "Anonymous";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export async function CommentsList({ jobId }: Props) {
  const comments = await getApprovedComments(jobId);

  if (comments.length === 0) {
    return <p className="text-sm text-muted">No comments yet. Be the first!</p>;
  }

  const guides = comments.filter((c) => c.is_guide);
  const regular = comments.filter((c) => !c.is_guide);

  return (
    <div className="space-y-6">
      {/* ── Guides section ── */}
      {guides.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-500">
            📖 Community Guides
          </p>
          {guides.map((comment) => (
            <div
              key={comment.id}
              className="rounded-xl border border-green-500/25 bg-green-500/5 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-green-500">
                  {displayName(comment)}
                  {comment.is_pinned && <span className="ml-2 text-primary">· Pinned</span>}
                </span>
                <span className="text-xs text-muted shrink-0">{formatDate(comment.created_at)}</span>
              </div>
              <p className="text-sm text-fg leading-relaxed">{comment.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Regular comments ── */}
      {regular.length > 0 && (
        <ul className="space-y-4 divide-y divide-border">
          {regular.map((comment) => (
            <li key={comment.id} className="pt-4 first:pt-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-fg">
                  {displayName(comment)}
                  {comment.is_pinned && (
                    <span className="ml-2 text-primary">· Pinned</span>
                  )}
                </span>
                <span className="text-xs text-muted shrink-0">
                  {formatDate(comment.created_at)}
                </span>
              </div>
              <p className="text-sm text-muted leading-relaxed">{comment.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
