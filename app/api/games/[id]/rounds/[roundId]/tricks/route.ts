import { NextRequest, NextResponse } from "next/server";
import getDb, { calculateScore } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { id, roundId } = await params;
    const gameId = parseInt(id);
    const roundIdNum = parseInt(roundId);
    const { tricks } = await request.json();

    const db = await getDb();

    const gameResult = await db.execute({
      sql: "SELECT * FROM games WHERE id = ?",
      args: [gameId],
    });
    if (gameResult.rows.length === 0) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    const game = gameResult.rows[0] as unknown as {
      status: string;
      player_order: string;
      num_rounds: number;
      current_round: number;
    };

    const roundResult = await db.execute({
      sql: "SELECT * FROM rounds WHERE id = ? AND game_id = ?",
      args: [roundIdNum, gameId],
    });
    if (roundResult.rows.length === 0) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }
    const round = roundResult.rows[0] as unknown as {
      num_cards: number;
      phase: string;
    };

    if (round.phase !== "scoring") {
      return NextResponse.json(
        { error: "Round is not in scoring phase" },
        { status: 400 }
      );
    }

    const playerIds: number[] = JSON.parse(game.player_order);

    const totalTricks = Object.values(tricks as Record<string, number>).reduce(
      (sum: number, t: number) => sum + t,
      0
    );
    if (totalTricks !== round.num_cards) {
      return NextResponse.json(
        {
          error: `Total tricks won (${totalTricks}) must equal cards dealt (${round.num_cards})`,
        },
        { status: 400 }
      );
    }

    // Get bids for scoring
    const bidsResult = await db.execute({
      sql: "SELECT * FROM bids WHERE round_id = ?",
      args: [roundIdNum],
    });
    const bidMap = new Map(
      (bidsResult.rows as unknown as { player_id: number; bid: number }[]).map(
        (b) => [b.player_id, b.bid]
      )
    );

    const trickStatements = Object.entries(tricks as Record<string, number>)
      .filter(([pidStr]) => playerIds.includes(parseInt(pidStr)))
      .map(([pidStr, tricksWon]) => {
        const pid = parseInt(pidStr);
        const bid = bidMap.get(pid) ?? 0;
        const score = calculateScore(bid, tricksWon);
        return {
          sql: "INSERT OR REPLACE INTO tricks (round_id, player_id, tricks_won, score) VALUES (?, ?, ?, ?)",
          args: [roundIdNum, pid, tricksWon, score] as (string | number)[],
        };
      });

    await db.batch(
      [
        ...trickStatements,
        {
          sql: "UPDATE rounds SET phase = 'completed' WHERE id = ?",
          args: [roundIdNum],
        },
      ],
      "write"
    );

    const isLastRound = game.current_round >= game.num_rounds;
    return NextResponse.json({ success: true, gameComplete: isLastRound });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to submit tricks" }, { status: 500 });
  }
}
