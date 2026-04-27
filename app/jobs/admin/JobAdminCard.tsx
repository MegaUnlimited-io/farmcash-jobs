"use client";

import { useState } from "react";
import Image from "next/image";

interface JobAdminCardProps {
  id: string;
  name: string;
  iconUrl: string | null;
  slug?: string;
  appPackageId?: string | null;
}

export function JobAdminCard({ id, name, iconUrl, slug, appPackageId }: JobAdminCardProps) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt=""
          width={32}
          height={32}
          style={{ width: 32, height: 32, minWidth: 32 }}
          className="rounded-lg shrink-0"
          unoptimized
        />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-border shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-sm text-fg font-medium truncate leading-tight">{name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] text-muted font-mono tracking-wide">
            …{id.slice(-6)}
          </span>

          {/* Copy UUID */}
          <button
            onClick={copy}
            title="Copy full UUID"
            className="flex items-center justify-center w-4 h-4 rounded text-muted hover:text-fg transition-colors"
            aria-label="Copy job ID"
          >
            {copied ? (
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-primary" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="4" width="6.5" height="7" rx="1" />
                <path d="M2.5 8H2a.5.5 0 0 1-.5-.5V1.5A.5.5 0 0 1 2 1h6a.5.5 0 0 1 .5.5V2" strokeLinecap="round" />
              </svg>
            )}
          </button>

          {/* FarmCash wiki link */}
          {slug && (
            <a
              href={`https://farmcash.app/jobs/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open on farmcash.app"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center w-4 h-4 rounded text-muted hover:text-primary transition-colors"
              aria-label="Open job page"
            >
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5">
                <circle cx="6" cy="6" r="4.5" />
                <path d="M6 1.5C4.5 3 3.75 4.5 3.75 6s.75 3 2.25 4.5" strokeLinecap="round" />
                <path d="M6 1.5C7.5 3 8.25 4.5 8.25 6S7.5 9 6 10.5" strokeLinecap="round" />
                <path d="M1.5 6h9" strokeLinecap="round" />
                <path d="M2 4h8M2 8h8" strokeLinecap="round" />
              </svg>
            </a>
          )}

          {/* Google Play link */}
          {appPackageId && (
            <a
              href={`https://play.google.com/store/apps/details?id=${appPackageId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open on Google Play"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center w-4 h-4 rounded text-muted hover:text-green-500 transition-colors"
              aria-label="Open on Google Play"
            >
              <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
                <path d="M1.5 1.2a.6.6 0 0 1 .9-.52l8.4 4.8a.6.6 0 0 1 0 1.04l-8.4 4.8a.6.6 0 0 1-.9-.52V1.2z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
