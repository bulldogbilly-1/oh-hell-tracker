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

    // Running scores per player
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
