"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Spade, Trash2 } from "lucide-react";
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

function GameCard({
  game,
  isAdmin,
  onDelete,
}: {
  game: Game;
  isAdmin: boolean;
  onDelete: (id: number) => void;
}) {
  const isActive = game.status === "active";

  return (
    <div className="relative mb-3">
      <Link href={`/games/${game.id}`}>
        <div className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-4 hover:border-[#10b981]/40 transition-all active:scale-[0.98]">
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {isActive
                  ? `Round ${game.current_round} of ${game.num_rounds}`
                  : `${game.num_rounds} rounds`}
              </span>
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(game.id);
                  }}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 size={14} />
                </button>
              )}
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
    </div>
  );
}

export default function GamesPage() {
  const { isAdmin } = useAdmin();
  const [games, setGames] = useState<Game[]>([]);
  const [tab, setTab] = useState<TabType>("all");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadGames = useCallback(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((data) => {
        setGames(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const [deleteError, setDeleteError] = useState("");

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/games/${deleteTarget}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setDeleteError(d.error || `Error ${res.status}`);
      setDeleting(false);
      return;
    }
    setDeleteTarget(null);
    setDeleting(false);
    loadGames();
  };

  const filtered = games.filter((g) => {
    if (tab === "active") return g.status === "active";
    if (tab === "completed") return g.status === "completed";
    return true;
  });

  const liveCount = games.filter((g) => g.status === "active").length;

  return (
    <div className="p-4">
      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-[#161b16] border border-[#2d3d2d] rounded-2xl p-5 w-full max-w-xs">
            <h3 className="text-lg font-bold mb-2">Delete Game?</h3>
            <p className="text-sm text-gray-400 mb-4">
              This will permanently delete all rounds and scores. ELO changes will be reversed if the game was completed.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#2d3d2d] text-gray-400 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-semibold"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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
        filtered.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            isAdmin={isAdmin}
            onDelete={setDeleteTarget}
          />
        ))
      )}
    </div>
  );
}
