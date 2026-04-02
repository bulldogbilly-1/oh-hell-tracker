"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Spade } from "lucide-react";
import { useAdmin } from "./context/AdminContext";

interface GamePlayer {
  id: number;
  name: string;
  color: string;
}

interface Game {
  id: number;
  status: "active" | "completed";
  player_order: string;
  num_rounds: number;
  current_round: number;
  created_at: string;
  completed_at: string | null;
  players: GamePlayer[];
}

type TabType = "all" | "active" | "completed";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function GameCard({ game }: { game: Game }) {
  const isActive = game.status === "active";

  return (
    <Link href={`/games/${game.id}`}>
      <div className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-4 mb-3 hover:border-[#10b981]/40 transition-all active:scale-[0.98]">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isActive
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30"
              }`}
            >
              {isActive ? "LIVE" : "DONE"}
            </span>
            <span className="text-xs text-gray-500">
              {formatDate(game.created_at)}
            </span>
          </div>
          <div className="text-xs text-gray-400">
            {isActive
              ? `Round ${game.current_round} of ${game.num_rounds}`
              : `${game.num_rounds} rounds`}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {game.players.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: p.color }}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-300">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default function GamesPage() {
  const { isAdmin } = useAdmin();
  const [games, setGames] = useState<Game[]>([]);
  const [tab, setTab] = useState<TabType>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((data) => {
        setGames(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = games.filter((g) => {
    if (tab === "active") return g.status === "active";
    if (tab === "completed") return g.status === "completed";
    return true;
  });

  const liveCount = games.filter((g) => g.status === "active").length;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
          <div className="flex items-center gap-2">
            <Spade size={20} className="text-[#10b981]" />
            <h1 className="text-2xl font-bold">Games</h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {games.length} total · {liveCount} live
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/games/new"
            className="flex items-center gap-1.5 bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            New
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0f160f] rounded-lg p-1 mb-4">
        {(["all", "active", "completed"] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
              tab === t
                ? "bg-[#161b16] text-[#10b981]"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Games list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Spade size={40} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">No games yet</p>
          {isAdmin && (
            <Link
              href="/games/new"
              className="inline-block mt-4 text-[#10b981] text-sm font-semibold"
            >
              Start your first game
            </Link>
          )}
        </div>
      ) : (
        filtered.map((g) => <GameCard key={g.id} game={g} />)
      )}
    </div>
  );
}
