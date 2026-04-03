import { NextRequest, NextResponse } from "next/server";
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
    const gameId = parseInt(id);
    const db = await getDb();

    const gameResult = await db.execute({
      sql: "SELECT * FROM games WHERE id = ?",
      args: [gameId],
    });
    if (gameResult.rows.length === 0) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    const game = gameResult.rows[0] as unknown as { status: string };

    // If game was completed, reverse ELO changes
    if (game.status === "completed") {
      const eloHistoryResult = await db.execute({
        sql: "SELECT * FROM elo_history WHERE game_id = ?",
        args: [gameId],
      });
      const eloHistory = eloHistoryResult.rows as unknown as {
        player_id: number;
        elo_change: number;
      }[];

      for (const entry of eloHistory) {
        await db.execute({
          sql: "UPDATE players SET elo = elo - ? WHERE id = ?",
          args: [entry.elo_change, entry.player_id],
        });
      }
    }

    // Delete all related records then the game
    await db.batch(
      [
        {
          sql: "DELETE FROM bids WHERE round_id IN (SELECT id FROM rounds WHERE game_id = ?)",
          args: [gameId],
        },
        {
          sql: "DELETE FROM tricks WHERE round_id IN (SELECT id FROM rounds WHERE game_id = ?)",
          args: [gameId],
        },
        { sql: "DELETE FROM rounds WHERE game_id = ?", args: [gameId] },
        { sql: "DELETE FROM elo_history WHERE game_id = ?", args: [gameId] },
        { sql: "DELETE FROM games WHERE id = ?", args: [gameId] },
      ],
      "write"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 });
  }
}
