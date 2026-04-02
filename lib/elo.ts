const K_FACTOR = 32;

/**
 * Expected score for player A against player B given their ELOs
 */
function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Calculate new ELO ratings for all players after a game.
 * Rankings: array of player IDs in finish order (index 0 = 1st place).
 * Ties allowed by passing same rank.
 *
 * Returns map of playerId -> eloChange
 */
export function calculateEloChanges(
  players: { id: number; elo: number }[],
  rankings: { playerId: number; rank: number }[] // rank 1 = best
): Map<number, number> {
  const n = players.length;
  const eloMap = new Map(players.map((p) => [p.id, p.elo]));
  const changes = new Map<number, number>(players.map((p) => [p.id, 0]));

  // Compare each pair
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const playerA = players[i];
      const playerB = players[j];

      const rankA = rankings.find((r) => r.playerId === playerA.id)?.rank ?? n;
      const rankB = rankings.find((r) => r.playerId === playerB.id)?.rank ?? n;

      let actualA: number;
      let actualB: number;

      if (rankA < rankB) {
        // A finished better
        actualA = 1.0;
        actualB = 0.0;
      } else if (rankA > rankB) {
        actualA = 0.0;
        actualB = 1.0;
      } else {
        // Tie
        actualA = 0.5;
        actualB = 0.5;
      }

      const expA = expectedScore(eloMap.get(playerA.id)!, eloMap.get(playerB.id)!);
      const expB = 1 - expA;

      const changeA = K_FACTOR * (actualA - expA);
      const changeB = K_FACTOR * (actualB - expB);

      changes.set(playerA.id, changes.get(playerA.id)! + changeA);
      changes.set(playerB.id, changes.get(playerB.id)! + changeB);
    }
  }

  // Normalize by (N-1) to make zero-sum
  for (const [id, change] of changes) {
    changes.set(id, change / (n - 1));
  }

  return changes;
}

/**
 * Assign ranks based on total game scores (higher = better).
 * Returns array of {playerId, rank} where rank 1 = winner.
 */
export function assignRanks(
  scores: { playerId: number; totalScore: number }[]
): { playerId: number; rank: number }[] {
  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);

  const result: { playerId: number; rank: number }[] = [];
  let rank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].totalScore < sorted[i - 1].totalScore) {
      rank = i + 1;
    }
    result.push({ playerId: sorted[i].playerId, rank });
  }

  return result;
}
