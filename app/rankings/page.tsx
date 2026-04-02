"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";

interface Player {
  id: number;
  name: string;
  color: string;
  elo: number;
}

interface EloChange {
  player_id: number;
  elo_change: number;
}

export default function RankingsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [recentChanges, setRecentChanges] = useState<Map<number, number>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [playersRes, gamesRes] = await Promise.all([
        fetch("/api/players"),
        fetch("/api/games"),
      ]);
      const playersData: Player[] = await playersRes.json();
      const gamesData = await gamesRes.json();

      // Get most recent completed game's ELO changes
      const completedGames = gamesData.filter(
        (g: { status: string }) => g.status === "completed"
      );
      const changeMap = new Map<number, number>();

      if (completedGames.length > 0) {
        const latestGame = completedGames[0];
        try {
          const res = await fetch(`/api/games/${latestGame.id}/elo-history`);
          if (res.ok) {
            const history: EloChange[] = await res.json();
            history.forEach((h) => changeMap.set(h.player_id, h.elo_change));
          }
        } catch {
          // ELO history endpoint may not exist - silently ignore
        }
      }

      setPlayers(playersData);
      setRecentChanges(changeMap);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  // Players sorted by ELO descending
  const ranked = [...players].sort((a, b) => b.elo - a.elo);

  const topPlayer = ranked[0];

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 pt-2">
        <Trophy size={20} className="text-[#10b981]" />
        <h1 className="text-2xl font-bold">Rankings</h1>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : players.length === 0 ? (
        <div className="text-center py-16">
          <Trophy size={40} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">No players yet</p>
        </div>
      ) : (
        <>
          {/* #1 Featured card */}
          {topPlayer && (
            <Link href={`/players/${topPlayer.id}`}>
              <div className="bg-gradient-to-br from-yellow-900/40 to-[#161b16] border border-yellow-500/30 rounded-2xl p-5 mb-4 flex items-center gap-4 hover:border-yellow-500/50 transition-all">
                <div className="relative">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl text-white"
                    style={{ backgroundColor: topPlayer.color }}
                  >
                    {topPlayer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                    #1
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-yellow-400 font-semibold mb-0.5">
                    RANKED #1
                  </div>
                  <div className="text-xl font-bold">{topPlayer.name}</div>
                  <div className="text-[#10b981] font-bold">
                    {Math.round(topPlayer.elo)} ELO
                  </div>
                </div>
                <Trophy size={32} className="text-yellow-400/60" />
              </div>
            </Link>
          )}

          {/* Rankings list */}
          <div className="space-y-2">
            {ranked.map((player, index) => {
              const recentChange = recentChanges.get(player.id);
              return (
                <Link key={player.id} href={`/players/${player.id}`}>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:border-[#10b981]/30 active:scale-[0.98] ${
                      index === 0
                        ? "border-yellow-500/20 bg-yellow-500/5"
                        : "border-[#1f2d1f] bg-[#161b16]"
                    }`}
                  >
                    <span
                      className={`text-sm font-bold w-6 text-center ${
                        index === 0
                          ? "text-yellow-400"
                          : index === 1
                          ? "text-gray-400"
                          : index === 2
                          ? "text-amber-600"
                          : "text-gray-600"
                      }`}
                    >
                      #{index + 1}
                    </span>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{player.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#10b981] font-bold text-sm">
                        {Math.round(player.elo)}
                      </div>
                      {recentChange !== undefined && (
                        <div
                          className={`text-[10px] font-semibold ${
                            recentChange >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {recentChange >= 0 ? "+" : ""}
                          {recentChange.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
