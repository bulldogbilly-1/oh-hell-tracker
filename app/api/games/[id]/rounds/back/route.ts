import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// POST /api/games/[id]/rounds/back
// Deletes the current round (clearing any bids/tricks) and reopens the previous
// round to scoring phase so results can be corrected.
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
    const game = gameResult.rows[0] as unknown as {
      current_round: number;
      status: string;
    };

    if (game.status !== "active") {
      return NextResponse.json({ error: "Game is not active" }, { status: 400 });
    }
    if (game.current_round <= 1) {
      return NextResponse.json(
        { error: "Already on the first round" },
        { status: 400 }
      );
    }

    // Get current round
    const currResult = await db.execute({
      sql: "SELECT * FROM rounds WHERE game_id = ? AND round_number = ?",
      args: [gameId, game.current_round],
    });
    const currentRound = currResult.rows[0] as unknown as { id: number } | undefined;

    // Get previous round
    const prevResult = await db.execute({
      sql: "SELECT * FROM rounds WHERE game_id = ? AND round_number = ?",
      args: [gameId, game.current_round - 1],
    });
    if (prevResult.rows.length === 0) {
      return NextResponse.json({ error: "Previous round not found" }, { status: 404 });
    }
    const prevRound = prevResult.rows[0] as unknown as { id: number };

    const statements: { sql: string; args: (string | number)[] }[] = [];

    // Clear and delete current round
    if (currentRound) {
      statements.push({
        sql: "DELETE FROM bids WHERE round_id = ?",
        args: [currentRound.id],
      });
      statements.push({
        sql: "DELETE FROM tricks WHERE round_id = ?",
        args: [currentRound.id],
      });
      statements.push({
        sql: "DELETE FROM rounds WHERE id = ?",
        args: [currentRound.id],
      });
    }

    // Reopen previous round: clear its tricks and set phase back to scoring
    statements.push({
      sql: "DELETE FROM tricks WHERE round_id = ?",
      args: [prevRound.id],
    });
    statements.push({
      sql: "UPDATE rounds SET phase = 'scoring' WHERE id = ?",
      args: [prevRound.id],
    });

    // Decrement current_round on game
    statements.push({
      sql: "UPDATE games SET current_round = current_round - 1 WHERE id = ?",
      args: [gameId],
    });

    await db.batch(statements, "write");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to go back to previous round" },
      { status: 500 }
    );
  }
}
