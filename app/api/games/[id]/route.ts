import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      id: number;
      status: string;
      player_order: string;
      num_rounds: number;
      current_round: number;
      min_cards: number;
      max_cards: number;
    };

    const playerIds: number[] = JSON.parse(game.player_order);
    const players = await Promise.all(
      playerIds.map((pid) =>
        db
          .execute({ sql: "SELECT * FROM players WHERE id = ?", args: [pid] })
          .then((r) => r.rows[0])
      )
    );

    const roundsResult = await db.execute({
      sql: "SELECT * FROM rounds WHERE game_id = ? ORDER BY round_number",
      args: [gameId],
    });

    const currentRoundResult = await db.execute({
      sql: "SELECT * FROM rounds WHERE game_id = ? AND round_number = ?",
      args: [gameId, game.current_round],
    });
    const currentRound =
      currentRoundResult.rows.length > 0
        ? (currentRoundResult.rows[0] as unknown as {
            id: number;
            round_number: number;
            num_cards: number;
            trump_suit: string;
            dealer_index: number;
            phase: string;
          })
        : null;

    let bids: unknown[] = [];
    let tricks: unknown[] = [];

    if (currentRound) {
      const bidsResult = await db.execute({
        sql: "SELECT * FROM bids WHERE round_id = ?",
        args: [currentRound.id],
      });
      const tricksResult = await db.execute({
        sql: "SELECT * FROM tricks WHERE round_id = ?",
        args: [currentRound.id],
      });
      bids = bidsResult.rows;
      tricks = tricksResult.rows;
    }

    const scores = await Promise.all(
      playerIds.map(async (pid) => {
        const result = await db.execute({
          sql: `
            SELECT COALESCE(SUM(t.score), 0) as total_score
            FROM tricks t
            JOIN rounds r ON r.id = t.round_id
            WHERE r.game_id = ? AND t.player_id = ?
          `,
          args: [gameId, pid],
        });
        const row = result.rows[0] as unknown as { total_score: number };
        return { playerId: pid, totalScore: row.total_score };
      })
    );

    return NextResponse.json({
      game,
      players,
      rounds: roundsResult.rows,
      currentRound,
      bids,
      tricks,
      scores,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch game" }, { status: 500 });
  }
}

export async function DELETE(
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
