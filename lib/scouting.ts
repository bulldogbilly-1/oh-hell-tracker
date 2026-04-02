import getDb from "./db";

export interface ScoutingItem {
  type: "strength" | "weakness";
  title: string;
  description: string;
}

export async function getScoutingReport(
  playerId: number
): Promise<ScoutingItem[]> {
  const db = await getDb();

  const result = await db.execute({
    sql: `
      SELECT
        b.bid,
        t.tricks_won,
        r.num_cards,
        t.score
      FROM bids b
      JOIN tricks t ON t.round_id = b.round_id AND t.player_id = b.player_id
      JOIN rounds r ON r.id = b.round_id
      JOIN games g ON g.id = r.game_id
      WHERE b.player_id = ?
        AND g.status = 'completed'
    `,
    args: [playerId],
  });

  const rows = result.rows as unknown as Array<{
    bid: number;
    tricks_won: number;
    num_cards: number;
    score: number;
  }>;

  const items: ScoutingItem[] = [];

  if (rows.length < 3) {
    return [
      {
        type: "strength",
        title: "Still Learning",
        description: "Play more games to unlock your scouting report.",
      },
    ];
  }

  const total = rows.length;
  const exactBids = rows.filter((r) => r.bid === r.tricks_won).length;
  const accuracy = exactBids / total;

  if (accuracy >= 0.6) {
    items.push({
      type: "strength",
      title: "Accurate Bidder",
      description: `Hits exact bid ${Math.round(accuracy * 100)}% of the time — well above average.`,
    });
  } else if (accuracy <= 0.35) {
    items.push({
      type: "weakness",
      title: "Inaccurate Bidder",
      description: `Only hits exact bid ${Math.round(accuracy * 100)}% of the time. Bids need calibration.`,
    });
  }

  const overbids = rows.filter((r) => r.bid > r.tricks_won).length;
  const underbids = rows.filter((r) => r.bid < r.tricks_won).length;
  const overbidRate = overbids / total;
  const underbidRate = underbids / total;

  if (overbidRate > 0.45) {
    items.push({
      type: "weakness",
      title: "Overconfident",
      description: `Overbids ${Math.round(overbidRate * 100)}% of rounds — tends to overestimate their hand strength.`,
    });
  } else if (underbidRate > 0.45) {
    items.push({
      type: "weakness",
      title: "Sandbagging",
      description: `Underbids ${Math.round(underbidRate * 100)}% of rounds — tends to be overly conservative.`,
    });
  } else if (Math.abs(overbidRate - underbidRate) < 0.1) {
    items.push({
      type: "strength",
      title: "Well-Calibrated",
      description: "Overbids and underbids at nearly equal rates — no systematic bias.",
    });
  }

  const highCardRows = rows.filter((r) => r.num_cards >= 5);
  const lowCardRows = rows.filter((r) => r.num_cards <= 3);

  if (highCardRows.length >= 3) {
    const highAcc =
      highCardRows.filter((r) => r.bid === r.tricks_won).length /
      highCardRows.length;
    if (highAcc >= 0.65) {
      items.push({
        type: "strength",
        title: "Big Round Specialist",
        description: `Excels in high-card rounds with ${Math.round(highAcc * 100)}% bid accuracy when many cards are dealt.`,
      });
    } else if (highAcc <= 0.3) {
      items.push({
        type: "weakness",
        title: "Struggles in Big Rounds",
        description: `Only ${Math.round(highAcc * 100)}% accuracy in rounds with many cards — complex hands cause errors.`,
      });
    }
  }

  if (lowCardRows.length >= 3) {
    const lowAcc =
      lowCardRows.filter((r) => r.bid === r.tricks_won).length /
      lowCardRows.length;
    if (lowAcc >= 0.65) {
      items.push({
        type: "strength",
        title: "Low Round Precision",
        description: `Hits ${Math.round(lowAcc * 100)}% of bids in low-card rounds — excellent at reading small hands.`,
      });
    } else if (lowAcc <= 0.3) {
      items.push({
        type: "weakness",
        title: "Low Round Trouble",
        description: `Struggles in 1-3 card rounds with only ${Math.round(lowAcc * 100)}% accuracy.`,
      });
    }
  }

  const avgScore = rows.reduce((sum, r) => sum + r.score, 0) / total;
  if (avgScore >= 8) {
    items.push({
      type: "strength",
      title: "High Scorer",
      description: `Averages ${avgScore.toFixed(1)} points per round — consistently contributes to their score.`,
    });
  }

  if (items.length === 0) {
    items.push({
      type: "strength",
      title: "Consistent Performer",
      description: "Plays a steady, balanced game with no major tendencies detected.",
    });
  }

  return items;
}
