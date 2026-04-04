import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getScoutingReport } from "@/lib/scouting";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const playerId = parseInt(id);
    const db = await getDb();

    const playerResult = await db.execute({
      sql: "SELECT * FROM players WHERE id = ?",
      args: [playerId],
    });
    if (playerResult.rows.length === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    const player = playerResult.rows[0];

    // Games this player participated in (completed only)
    const gamesResult = await db.execute({
      sql: `
        SELECT g.id
        FROM games g
        WHERE g.status = 'completed'
          AND EXISTS (
            SELECT 1 FROM JSON_EACH(g.player_order) je
            WHERE CAST(je.value AS INTEGER) = ?
          )
      `,
      args: [playerId],
    });
    const gamesWithPlayer = gamesResult.rows as unknown as { id: number }[];

    let wins = 0;
    let totalPlace = 0;

    for (const game of gamesWithPlayer) {
      const scoresResult = await db.execute({
        sql: `
          SELECT t.player_id, SUM(t.score) as total_score
          FROM tricks t
          JOIN rounds r ON r.id = t.round_id
          WHERE r.game_id = ?
          GROUP BY t.player_id
          ORDER BY total_score DESC
        `,
        args: [game.id],
      });
      const scores = scoresResult.rows as unknown as {
        player_id: number;
        total_score: number;
      }[];

      let place = 1;
      for (let i = 0; i < scores.length; i++) {
        if (scores[i].player_id === playerId) {
          place = i + 1;
          break;
        }
      }
      if (place === 1) wins++;
      totalPlace += place;
    }

    const gamesCount = gamesWithPlayer.length;
    const avgPlace = gamesCount > 0 ? totalPlace / gamesCount : 0;

    // Bid accuracy
    const bidStatsResult = await db.execute({
      sql: `
        SELECT
          COUNT(*) as total_bids,
          SUM(CASE WHEN b.bid = t.tricks_won THEN 1 ELSE 0 END) as exact_bids,
          SUM(CASE WHEN b.bid > t.tricks_won THEN 1 ELSE 0 END) as overbids,
          SUM(CASE WHEN b.bid < t.tricks_won THEN 1 ELSE 0 END) as underbids,
          AVG(b.bid) as avg_bid
        FROM bids b
        JOIN tricks t ON t.round_id = b.round_id AND t.player_id = b.player_id
        JOIN rounds r ON r.id = b.round_id
        JOIN games g ON g.id = r.game_id
        WHERE b.player_id = ?
          AND g.status = 'completed'
      `,
      args: [playerId],
    });
    const bidStats = bidStatsResult.rows[0] as unknown as {
      total_bids: number;
      exact_bids: number;
      overbids: number;
      underbids: number;
      avg_bid: number;
    };

    const accuracy =
      bidStats.total_bids > 0
        ? bidStats.exact_bids / bidStats.total_bids
        : 0;
    const overbidPct =
      bidStats.total_bids > 0
        ? Math.round((bidStats.overbids / bidStats.total_bids) * 100)
        : 0;
    const underbidPct =
      bidStats.total_bids > 0
        ? Math.round((bidStats.underbids / bidStats.total_bids) * 100)
        : 0;
    const winRate = gamesCount > 0 ? Math.round((wins / gamesCount) * 100) : 0;

    // ELO history
    const eloHistoryResult = await db.execute({
      sql: `
        SELECT eh.*, g.created_at as game_date
        FROM elo_history eh
        JOIN games g ON g.id = eh.game_id
        WHERE eh.player_id = ?
        ORDER BY eh.id ASC
      `,
      args: [playerId],
    });

    // Scouting report
    const scoutingReport = await getScoutingReport(playerId);

    return NextResponse.json({
      player,
      stats: {
        games: gamesCount,
        wins,
        winRate,
        avgBid: bidStats.avg_bid || 0,
        accuracy: Math.round(accuracy * 100),
        overbidPct,
        underbidPct,
        avgPlace,
        elo: (player as unknown as { elo: number }).elo,
      },
      eloHistory: eloHistoryResult.rows,
      scoutingReport,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch player" }, { status: 500 });
  }
}
