import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
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
    const { bids } = await request.json();

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

    if (round.phase !== "bidding") {
      return NextResponse.json(
        { error: "Round is not in bidding phase" },
        { status: 400 }
      );
    }

    const playerIds: number[] = JSON.parse(game.player_order);

    const totalBids = Object.values(bids as Record<string, number>).reduce(
      (sum: number, b: number) => sum + b,
      0
    );
    if (totalBids === round.num_cards) {
      return NextResponse.json(
        {
          error: `Total bids (${totalBids}) cannot equal number of cards (${round.num_cards}) - dealer must adjust bid`,
        },
        { status: 400 }
      );
    }

    const bidStatements = Object.entries(bids as Record<string, number>)
      .filter(([pidStr]) => playerIds.includes(parseInt(pidStr)))
      .map(([pidStr, bidAmount]) => ({
        sql: "INSERT OR REPLACE INTO bids (round_id, player_id, bid) VALUES (?, ?, ?)",
        args: [roundIdNum, parseInt(pidStr), bidAmount] as (string | number)[],
      }));

    await db.batch(
      [
        ...bidStatements,
        {
          sql: "UPDATE rounds SET phase = 'scoring' WHERE id = ?",
          args: [roundIdNum],
        },
      ],
      "write"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to submit bids" }, { status: 500 });
  }
}
