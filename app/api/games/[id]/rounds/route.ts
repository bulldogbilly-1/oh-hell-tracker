import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getTrumpSuit, getNumCardsForRound } from "@/lib/db";
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
    const game = gameResult.rows[0] as unknown as {
      id: number;
      status: string;
      player_order: string;
      num_rounds: number;
      current_round: number;
    };

    if (game.status !== "active") {
      return NextResponse.json({ error: "Game is not active" }, { status: 400 });
    }

    const nextRound = game.current_round + 1;
    if (nextRound > game.num_rounds) {
      return NextResponse.json(
        { error: "All rounds already played" },
        { status: 400 }
      );
    }

    const playerIds: number[] = JSON.parse(game.player_order);
    const numPlayers = playerIds.length;
    const maxCards = Math.ceil(game.num_rounds / 2);
    const numCards = getNumCardsForRound(nextRound, maxCards);
    const trumpSuit = getTrumpSuit(nextRound - 1);
    const dealerIndex = (nextRound - 1) % numPlayers;

    await db.batch([
      {
        sql: "INSERT INTO rounds (game_id, round_number, num_cards, trump_suit, dealer_index) VALUES (?, ?, ?, ?, ?)",
        args: [gameId, nextRound, numCards, trumpSuit, dealerIndex],
      },
      {
        sql: "UPDATE games SET current_round = ? WHERE id = ?",
        args: [nextRound, gameId],
      },
    ], "write");

    const roundResult = await db.execute({
      sql: "SELECT * FROM rounds WHERE game_id = ? AND round_number = ?",
      args: [gameId, nextRound],
    });

    return NextResponse.json(roundResult.rows[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to start next round" }, { status: 500 });
  }
}
