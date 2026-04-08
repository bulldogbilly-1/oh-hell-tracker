import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import getDb from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const playerId = parseInt(id);

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Upload to Vercel Blob, overwriting any previous avatar for this player
    const blob = await put(`avatars/player-${playerId}`, file, {
      access: "public",
    });

    // Save URL to database
    const db = await getDb();
    await db.execute({
      sql: "UPDATE players SET avatar_url = ? WHERE id = ?",
      args: [blob.url, playerId],
    });

    return NextResponse.json({ avatarUrl: blob.url });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to upload avatar: ${message}` }, { status: 500 });
  }
}
