"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Medal } from "lucide-react";

interface Player {
  id: number;
  name: string;
  color: string;
  elo: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (stats: PlayerAchievementStats) => boolean;
}

interface PlayerAchievementStats {
  games: number;
  wins: number;
  elo: number;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_game",
    title: "First Blood",
    description: "Play your first game",
    icon: "🎴",
    condition: (s) => s.games >= 1,
  },
  {
    id: "five_games",
    title: "Regular",
    description: "Play 5 games",
    icon: "🃏",
    condition: (s) => s.games >= 5,
  },
  {
    id: "ten_games",
    title: "Veteran",
    description: "Play 10 games",
    icon: "🏅",
    condition: (s) => s.games >= 10,
  },
  {
    id: "first_win",
    title: "Winner",
    description: "Win your first game",
    icon: "🏆",
    condition: (s) => s.wins >= 1,
  },
  {
    id: "five_wins",
    title: "Champion",
    description: "Win 5 games",
    icon: "👑",
    condition: (s) => s.wins >= 5,
  },
  {
    id: "high_elo",
    title: "Elite",
    description: "Reach 1100 ELO",
    icon: "⚡",
    condition: (s) => s.elo >= 1100,
  },
  {
    id: "master_elo",
    title: "Master",
    description: "Reach 1200 ELO",
    icon: "🌟",
    condition: (s) => s.elo >= 1200,
  },
];

export default function AchievementsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerStats, setPlayerStats] = useState<
    Map<number, PlayerAchievementStats>
  >(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const playersRes = await fetch("/api/players");
      const playersData: Player[] = await playersRes.json();
      setPlayers(playersData);

      const statsMap = new Map<number, PlayerAchievementStats>();
      await Promise.all(
        playersData.map(async (p) => {
          try {
            const res = await fetch(`/api/players/${p.id}`);
            if (res.ok) {
              const d = await res.json();
              statsMap.set(p.id, {
                games: d.stats.games,
                wins: d.stats.wins,
                elo: p.elo,
              });
            }
          } catch {
            statsMap.set(p.id, { games: 0, wins: 0, elo: p.elo });
          }
        })
      );
      setPlayerStats(statsMap);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  // Count total achievements unlocked per player
  const playerAchievementCounts = players.map((p) => {
    const stats = playerStats.get(p.id) || { games: 0, wins: 0, elo: p.elo };
    const unlocked = ACHIEVEMENTS.filter((a) => a.condition(stats)).length;
    return { player: p, unlocked, stats };
  });

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 pt-2">
        <Medal size={20} className="text-[#10b981]" />
        <h1 className="text-2xl font-bold">Achievements</h1>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : players.length === 0 ? (
        <div className="text-center py-16">
          <Medal size={40} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">No players yet</p>
        </div>
      ) : (
        <>
          {/* Achievement list by player */}
          {playerAchievementCounts
            .sort((a, b) => b.unlocked - a.unlocked)
            .map(({ player, unlocked, stats }) => (
              <div key={player.id} className="mb-5">
                <Link href={`/players/${player.id}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold">{player.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {unlocked}/{ACHIEVEMENTS.length}
                    </span>
                  </div>
                </Link>

                <div className="grid grid-cols-2 gap-2">
                  {ACHIEVEMENTS.map((a) => {
                    const isUnlocked = a.condition(stats);
                    return (
                      <div
                        key={a.id}
                        className={`p-3 rounded-xl border flex items-start gap-2 ${
                          isUnlocked
                            ? "border-[#10b981]/30 bg-[#10b981]/10"
                            : "border-[#1f2d1f] bg-[#161b16] opacity-50"
                        }`}
                      >
                        <span className="text-xl leading-none">
                          {isUnlocked ? a.icon : "🔒"}
                        </span>
                        <div>
                          <div
                            className={`text-xs font-bold ${
                              isUnlocked ? "text-[#10b981]" : "text-gray-500"
                            }`}
                          >
                            {a.title}
                          </div>
                          <div className="text-[10px] text-gray-600 mt-0.5">
                            {a.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
