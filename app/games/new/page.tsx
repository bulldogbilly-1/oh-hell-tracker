"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useAdmin } from "../../context/AdminContext";

interface Player {
  id: number;
  name: string;
  color: string;
  elo: number;
}

export default function NewGamePage() {
  const { isAdmin, isLoading } = useAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, isLoading, router]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [maxCards, setMaxCards] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then(setPlayers);
  }, []);

  const togglePlayer = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const numRounds = 2 * maxCards - 1;

  const handleStart = async () => {
    if (selected.length < 2) {
      setError("Select at least 2 players");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: selected, maxCards }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create game");
      }
      const game = await res.json();
      router.push(`/games/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        <Link href="/" className="text-gray-400 hover:text-white">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold">New Game</h1>
      </div>

      {/* Players */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Select Players ({selected.length})
        </h2>
        {players.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No players yet.{" "}
            <Link href="/players" className="text-[#10b981]">
              Add players first
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {players.map((p) => {
              const isSelected = selected.includes(p.id);
              const seatNum = selected.indexOf(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "border-[#10b981]/60 bg-[#10b981]/10"
                      : "border-[#1f2d1f] bg-[#161b16] hover:border-[#2d3d2d]"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      ELO {Math.round(p.elo)}
                    </div>
                  </div>
                  {isSelected ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        Seat {seatNum + 1}
                      </span>
                      <div className="w-5 h-5 rounded-full bg-[#10b981] flex items-center justify-center">
                        <Check size={12} />
                      </div>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-gray-600" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Max Cards */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Max Cards per Player
        </h2>
        <div className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setMaxCards((v) => Math.max(1, v - 1))}
              className="w-10 h-10 rounded-lg bg-[#0f160f] border border-[#2d3d2d] flex items-center justify-center hover:border-[#10b981]/40"
            >
              <Minus size={16} />
            </button>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#10b981]">{maxCards}</div>
              <div className="text-xs text-gray-500 mt-1">cards</div>
            </div>
            <button
              onClick={() => setMaxCards((v) => Math.min(13, v + 1))}
              className="w-10 h-10 rounded-lg bg-[#0f160f] border border-[#2d3d2d] flex items-center justify-center hover:border-[#10b981]/40"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="text-center text-xs text-gray-500">
            {numRounds} rounds total (1 → {maxCards} → 1)
          </div>
        </div>
      </div>

      {/* Game preview */}
      {selected.length >= 2 && (
        <div className="mb-6 bg-[#161b16] border border-[#1f2d1f] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Dealer Order
          </h3>
          <div className="space-y-2">
            {selected.map((pid, i) => {
              const p = players.find((pl) => pl.id === pid)!;
              if (!p) return null;
              return (
                <div key={pid} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-4">{i + 1}.</span>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0)}
                  </div>
                  <span className="text-sm">{p.name}</span>
                  {i === 0 && (
                    <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded ml-1">
                      First Dealer
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={loading || selected.length < 2}
        className="w-full bg-[#10b981] hover:bg-[#059669] disabled:bg-[#10b981]/30 disabled:text-white/40 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
      >
        {loading ? "Starting..." : "Start Game"}
      </button>
    </div>
  );
}
