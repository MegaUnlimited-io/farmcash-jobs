import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/db/admin";
import { createServiceClient } from "@/lib/supabase/service";

type Action = "listing" | "featured" | "ratings" | "job";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await isAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, slug } = body as Record<string, unknown>;

  const revalidated: string[] = [];

  switch (action as Action) {
    // { expire: 0 } = invalidate immediately; next request fetches fresh data.
    case "listing":
      revalidateTag("jobs-listing", { expire: 0 });
      revalidatePath("/jobs");
      revalidated.push("jobs-listing", "/jobs");
      break;

    case "featured":
      revalidateTag("jobs-featured", { expire: 0 });
      revalidatePath("/jobs");
      revalidated.push("jobs-featured", "/jobs");
      break;

    case "ratings":
      revalidateTag("ratings-all", { expire: 0 });
      revalidated.push("ratings-all");
      break;

    case "job": {
      if (typeof slug !== "string" || !slug.trim()) {
        return NextResponse.json({ error: "slug required for job revalidation" }, { status: 400 });
      }
      const db = createServiceClient();
      const { data: job } = await db
        .from("jobs")
        .select("id")
        .eq("slug", slug.trim())
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobId = (job as any)?.id as string | undefined;
      if (!jobId) {
        return NextResponse.json({ error: `No job found with slug "${slug}"` }, { status: 404 });
      }

      revalidateTag(`job:${slug}`, { expire: 0 });
      revalidateTag(`ratings:${jobId}`, { expire: 0 });
      revalidatePath(`/jobs/${slug}`);
      revalidated.push(`job:${slug}`, `ratings:${jobId}`, `/jobs/${slug}`);
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, revalidated });
}
