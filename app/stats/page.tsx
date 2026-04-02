"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart2, ChevronUp, ChevronDown } from "lucide-react";

interface Player {
  id: number;
  name: string;
  color: string;
  elo: number;
}

interface GameSummary {
  id: number;
  status: string;
  player_order: string;
  players: Player[];
}

interface PlayerStat {
  id: number;
  name: string;
  color: string;
  elo: number;
  games: number;
  wins: number;
  winRate: number;
  avgPlace: number;
}

type SortKey = "elo" | "games" | "wins" | "winRate" | "avgPlace";
type SortDir = "asc" | "desc";

export default function StatsPage() {
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("elo");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    async function load() {
      const [playersRes, gamesRes] = await Promise.all([
        fetch("/api/players"),
        fetch("/api/games"),
      ]);
      const players: Player[] = await playersRes.json();
      const games: GameSummary[] = await gamesRes.json();

      const completedGames = games.filter((g) => g.status === "completed");

      const playerStats: PlayerStat[] = players.map((p) => {
        // Find games this player was in
        const myGames = completedGames.filter((g) => {
          const ids: number[] = JSON.parse(g.player_order);
          return ids.includes(p.id);
        });

        const gamesCount = myGames.length;
        return {
          id: p.id,
          name: p.name,
          color: p.color,
          elo: p.elo,
          games: gamesCount,
          wins: 0,
          winRate: 0,
          avgPlace: 0,
        };
      });

      // Fetch individual stats for each player with games
      const enriched = await Promise.all(
        playerStats.map(async (ps) => {
          if (ps.games === 0) return ps;
          try {
            const res = await fetch(`/api/players/${ps.id}`);
            if (!res.ok) return ps;
            const d = await res.json();
            return {
              ...ps,
              wins: d.stats.wins,
              winRate:
                d.stats.games > 0
                  ? Math.round((d.stats.wins / d.stats.games) * 100)
                  : 0,
              avgPlace: d.stats.avgPlace,
            };
          } catch {
            return ps;
          }
        })
      );

      setStats(enriched);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...stats].sort((a, b) => {
    let av = a[sortKey];
    let bv = b[sortKey];
    // For avgPlace, lower is better; invert for proper sorting
    const mult =
      sortDir === "desc"
        ? sortKey === "avgPlace"
          ? 1
          : -1
        : sortKey === "avgPlace"
        ? -1
        : 1;
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * mult;
    }
    return 0;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col)
      return <span className="text-gray-700 text-[10px]">↕</span>;
    return sortDir === "desc" ? (
      <ChevronDown size={12} className="text-[#10b981]" />
    ) : (
      <ChevronUp size={12} className="text-[#10b981]" />
    );
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "elo", label: "ELO" },
    { key: "games", label: "GP" },
    { key: "wins", label: "W" },
    { key: "winRate", label: "Win%" },
    { key: "avgPlace", label: "Avg#" },
  ];

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 pt-2">
        <BarChart2 size={20} className="text-[#10b981]" />
        <h1 className="text-2xl font-bold">Stats</h1>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : stats.length === 0 ? (
        <div className="text-center py-16">
          <BarChart2 size={40} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">No data yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4">
          <div className="min-w-max px-4">
            {/* Column headers */}
            <div className="flex items-center gap-1 mb-2 pl-1">
              <div className="w-40 shrink-0 text-xs text-gray-500 font-semibold">
                Player
              </div>
              {columns.map((col) => (
                <button
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`w-14 text-center flex items-center justify-center gap-0.5 text-xs font-semibold py-1 rounded transition-colors ${
                    sortKey === col.key
                      ? "text-[#10b981]"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {col.label}
                  <SortIcon col={col.key} />
                </button>
              ))}
            </div>

            {/* Rows */}
            <div className="space-y-2">
              {sorted.map((p, i) => (
                <Link key={p.id} href={`/players/${p.id}`}>
                  <div className="flex items-center gap-1 bg-[#161b16] border border-[#1f2d1f] rounded-xl px-3 py-2.5 hover:border-[#10b981]/30 transition-all active:scale-[0.98]">
                    <div className="w-40 shrink-0 flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-4">{i + 1}</span>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold truncate max-w-[80px]">
                        {p.name}
                      </span>
                    </div>
                    <div className="w-14 text-center text-sm font-bold text-[#10b981]">
                      {Math.round(p.elo)}
                    </div>
                    <div className="w-14 text-center text-sm text-gray-300">
                      {p.games}
                    </div>
                    <div className="w-14 text-center text-sm text-gray-300">
                      {p.wins}
                    </div>
                    <div className="w-14 text-center text-sm text-gray-300">
                      {p.games > 0 ? `${p.winRate}%` : "—"}
                    </div>
                    <div className="w-14 text-center text-sm text-gray-300">
                      {p.avgPlace > 0 ? `#${p.avgPlace.toFixed(1)}` : "—"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
