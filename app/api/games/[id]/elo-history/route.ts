import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gameId = parseInt(id);
    const db = await getDb();

    const result = await db.execute({
      sql: "SELECT * FROM elo_history WHERE game_id = ?",
      args: [gameId],
    });

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch ELO history" }, { status: 500 });
  }
}
