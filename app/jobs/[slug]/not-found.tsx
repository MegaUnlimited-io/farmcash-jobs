import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">🌾</div>
      <h1 className="text-2xl font-bold mb-2">Job Not Found</h1>
      <p className="text-muted mb-6 max-w-xs">
        This offer may have ended or never existed. Browse active jobs below.
      </p>
      <Link
        href="/jobs"
        className="px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors"
      >
        Browse Jobs
      </Link>
    </main>
  );
}
