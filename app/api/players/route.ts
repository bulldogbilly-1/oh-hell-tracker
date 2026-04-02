import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const PLAYER_COLORS = [
  "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#3b82f6", "#ec4899", "#14b8a6", "#f97316",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
}

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.execute("SELECT * FROM players ORDER BY elo DESC");
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch players" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { name, color } = await request.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const db = await getDb();
    const playerColor = color || getColorForName(name.trim());

    const result = await db.execute({
      sql: "INSERT INTO players (name, color) VALUES (?, ?)",
      args: [name.trim(), playerColor],
    });

    const player = await db.execute({
      sql: "SELECT * FROM players WHERE id = ?",
      args: [Number(result.lastInsertRowid)],
    });

    return NextResponse.json(player.rows[0], { status: 201 });
  } catch (error: unknown) {
    console.error(error);
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint")
    ) {
      return NextResponse.json(
        { error: "Player name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create player" }, { status: 500 });
  }
}
