import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getTrumpSuit, getNumCardsForRound, getNumRounds } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const db = await getDb();
    const gamesResult = await db.execute(
      "SELECT * FROM games ORDER BY created_at DESC"
    );

    const games = gamesResult.rows as unknown as Array<{
      id: number;
      status: string;
      player_order: string;
      num_rounds: number;
      current_round: number;
      created_at: string;
      completed_at: string | null;
    }>;

    const enriched = await Promise.all(
      games.map(async (game) => {
        const playerIds: number[] = JSON.parse(game.player_order);
        const players = await Promise.all(
          playerIds.map((pid) =>
            db
              .execute({ sql: "SELECT id, name, color, avatar_url FROM players WHERE id = ?", args: [pid] })
              .then((r) => r.rows[0])
          )
        );
        return { ...game, players };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { playerIds, maxCards, minCards = 1 } = await request.json();

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length < 2) {
      return NextResponse.json(
        { error: "At least 2 players required" },
        { status: 400 }
      );
    }
    if (!maxCards || maxCards < 1) {
      return NextResponse.json(
        { error: "maxCards must be >= 1" },
        { status: 400 }
      );
    }
    if (minCards < 1 || minCards > maxCards) {
      return NextResponse.json(
        { error: "minCards must be between 1 and maxCards" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const numRounds = getNumRounds(maxCards, minCards);

    const gameResult = await db.execute({
      sql: "INSERT INTO games (player_order, num_rounds, min_cards, max_cards) VALUES (?, ?, ?, ?)",
      args: [JSON.stringify(playerIds), numRounds, minCards, maxCards],
    });
    const gameId = Number(gameResult.lastInsertRowid);

    const numCards = getNumCardsForRound(1, maxCards, minCards);
    const trumpSuit = getTrumpSuit(0);

    await db.execute({
      sql: "INSERT INTO rounds (game_id, round_number, num_cards, trump_suit, dealer_index) VALUES (?, ?, ?, ?, ?)",
      args: [gameId, 1, numCards, trumpSuit, 0],
    });

    const game = await db.execute({
      sql: "SELECT * FROM games WHERE id = ?",
      args: [gameId],
    });

    return NextResponse.json(game.rows[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
  }
}
