import { NextRequest, NextResponse } from "next/server";
import getDb, { calculateMaxPossibleScore } from "@/lib/db";
import { calculateEloChanges, assignRanks } from "@/lib/elo";
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
      min_cards: number;
      max_cards: number;
    };

    if (game.status === "completed") {
      return NextResponse.json({ error: "Game already completed" }, { status: 400 });
    }

    const playerIds: number[] = JSON.parse(game.player_order);

    // Calculate final scores
    const finalScores = await Promise.all(
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

    const rankings = assignRanks(finalScores);

    // Normalize scores: each player's score as a fraction of max possible
    const maxPossibleScore = calculateMaxPossibleScore(game.max_cards, game.min_cards);
    const normalizedScores = finalScores.map((s) => ({
      playerId: s.playerId,
      normalizedScore: maxPossibleScore > 0 ? s.totalScore / maxPossibleScore : 0,
    }));

    // Get current ELOs
    const players = await Promise.all(
      playerIds.map(async (pid) => {
        const result = await db.execute({
          sql: "SELECT id, elo FROM players WHERE id = ?",
          args: [pid],
        });
        return result.rows[0] as unknown as { id: number; elo: number };
      })
    );

    const eloChanges = calculateEloChanges(players, normalizedScores);

    // Update ELOs, record history, mark game completed — all in one batch
    const eloStatements = players.flatMap((player) => {
      const change = eloChanges.get(player.id) ?? 0;
      const newElo = player.elo + change;
      return [
        {
          sql: "UPDATE players SET elo = ? WHERE id = ?",
          args: [newElo, player.id] as (string | number)[],
        },
        {
          sql: "INSERT INTO elo_history (player_id, game_id, elo_before, elo_after, elo_change) VALUES (?, ?, ?, ?, ?)",
          args: [player.id, gameId, player.elo, newElo, change] as (string | number)[],
        },
      ];
    });

    await db.batch(
      [
        ...eloStatements,
        {
          sql: "UPDATE games SET status = 'completed', completed_at = datetime('now') WHERE id = ?",
          args: [gameId],
        },
      ],
      "write"
    );

    // Build final standings
    const standings = await Promise.all(
      finalScores.map(async (s) => {
        const rank = rankings.find((r) => r.playerId === s.playerId)?.rank ?? 0;
        const eloChange = eloChanges.get(s.playerId) ?? 0;
        const playerResult = await db.execute({
          sql: "SELECT * FROM players WHERE id = ?",
          args: [s.playerId],
        });
        const player = playerResult.rows[0] as unknown as {
          id: number;
          name: string;
          elo: number;
        };
        return {
          playerId: s.playerId,
          playerName: player.name,
          totalScore: s.totalScore,
          rank,
          eloChange: Math.round(eloChange * 10) / 10,
          newElo: player.elo,
        };
      })
    );

    return NextResponse.json({
      success: true,
      standings: standings.sort((a, b) => a.rank - b.rank),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to complete game" }, { status: 500 });
  }
}
