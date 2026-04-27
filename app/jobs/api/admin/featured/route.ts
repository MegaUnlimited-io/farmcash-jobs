import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isAdmin,
  getFeaturedList,
  addFeatured,
  removeFeatured,
  reorderFeatured,
} from "@/lib/db/admin";

async function guardAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = await isAdmin(user.id);
  return admin ? user : null;
}

export async function GET() {
  const user = await guardAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await getFeaturedList();
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const user = await guardAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { jobId } = body as Record<string, unknown>;
  if (typeof jobId !== "string" || !jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const result = await addFeatured(jobId);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await guardAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { jobId } = body as Record<string, unknown>;
  if (typeof jobId !== "string" || !jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  try {
    await removeFeatured(jobId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await guardAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { orderedJobIds } = body as Record<string, unknown>;
  if (!Array.isArray(orderedJobIds) || orderedJobIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "orderedJobIds must be string[]" }, { status: 400 });
  }

  try {
    await reorderFeatured(orderedJobIds as string[]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
