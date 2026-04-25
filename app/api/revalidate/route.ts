import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// Called by the sync-jobs Edge Function after each successful sync run.
// Body: { slugs: string[], revalidateListing: boolean, secret: string }
export async function POST(req: NextRequest) {
  let body: { slugs?: string[]; revalidateListing?: boolean; secret?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slugs = [], revalidateListing = false, secret } = body;

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const revalidated: string[] = [];

  if (revalidateListing) {
    revalidatePath("/jobs");
    revalidated.push("_listing");
  }

  for (const slug of slugs) {
    if (typeof slug === "string" && slug.length > 0) {
      revalidatePath(`/jobs/${slug}`);
      revalidated.push(slug);
    }
  }

  return NextResponse.json({ ok: true, revalidated });
}
