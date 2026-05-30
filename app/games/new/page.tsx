"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Minus,
  Plus,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Link from "next/link";
import { useAdmin } from "../../context/AdminContext";
import PlayerAvatar from "../../components/PlayerAvatar";

interface Player {
  id: number;
  name: string;
  color: string;
  elo: number;
  avatar_url?: string | null;
}

export default function NewGamePage() {
  const { isAdmin, isLoading } = useAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, isLoading, router]);

  const [step, setStep] = useState<1 | 2>(1);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [seatOrder, setSeatOrder] = useState<number[]>([]);
  const [minCards, setMinCards] = useState(1);
  const [maxCards, setMaxCards] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

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

  const goToStep2 = () => {
    setSeatOrder([...selected]);
    setStep(2);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setSeatOrder((prev) => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr;
    });
  };

  const moveDown = (index: number) => {
    setSeatOrder((prev) => {
      if (index >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      return arr;
    });
  };

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOver(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex.current === null || dragIndex.current === index) {
      setDragOver(null);
      return;
    }
    setSeatOrder((prev) => {
      const arr = [...prev];
      const [removed] = arr.splice(dragIndex.current!, 1);
      arr.splice(index, 0, removed);
      return arr;
    });
    dragIndex.current = null;
    setDragOver(null);
  };

  const numRounds = 2 * (maxCards - minCards) + 1;

  const handleStart = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: seatOrder, maxCards, minCards }),
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

  // ── Step 1: Select Players ──────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1 pt-2">
          <Link href="/" className="text-gray-400 hover:text-white">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold">New Game</h1>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#10b981]" />
            <div className="w-2 h-2 rounded-full bg-[#1f2d1f]" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-5 pl-10">Step 1 of 2</p>

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
          <div className="space-y-2 mb-6">
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
                  <PlayerAvatar
                    name={p.name}
                    color={p.color}
                    avatarUrl={p.avatar_url}
                    size="w-10 h-10"
                  />
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      ELO {Math.round(p.elo)}
                    </div>
                  </div>
                  {isSelected ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        #{seatNum + 1}
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

        <button
          onClick={goToStep2}
          disabled={selected.length < 2}
          className="w-full bg-[#10b981] hover:bg-[#059669] disabled:bg-[#10b981]/30 disabled:text-white/40 text-white font-bold py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
        >
          Next: Set Seating Order <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  // ── Step 2: Seating Order + Settings ───────────────────────────────────────
  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1 pt-2">
        <button
          onClick={() => setStep(1)}
          className="text-gray-400 hover:text-white"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold">Seating Order</h1>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#1f2d1f]" />
          <div className="w-2 h-2 rounded-full bg-[#10b981]" />
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-5 pl-10">Step 2 of 2</p>

      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Player Order
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Drag to reorder · first player deals first
      </p>

      <div className="space-y-2 mb-6">
        {seatOrder.map((pid, index) => {
          const p = players.find((pl) => pl.id === pid);
          if (!p) return null;
          return (
            <div
              key={pid}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragLeave={() => setDragOver(null)}
              onDragEnd={() => setDragOver(null)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                dragOver === index
                  ? "border-[#10b981]/60 bg-[#10b981]/10 scale-[1.01]"
                  : "border-[#1f2d1f] bg-[#161b16]"
              }`}
            >
              <GripVertical
                size={16}
                className="text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0"
              />
              <span className="text-sm text-gray-500 w-4 flex-shrink-0">
                {index + 1}.
              </span>
              <PlayerAvatar
                name={p.name}
                color={p.color}
                avatarUrl={p.avatar_url}
                size="w-10 h-10"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{p.name}</div>
                {index === 0 && (
                  <div className="text-[10px] text-amber-400">
                    First Dealer
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="w-7 h-7 rounded-lg bg-[#0f160f] border border-[#2d3d2d] flex items-center justify-center disabled:opacity-25 hover:border-[#10b981]/40 active:scale-95 transition-all"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === seatOrder.length - 1}
                  className="w-7 h-7 rounded-lg bg-[#0f160f] border border-[#2d3d2d] flex items-center justify-center disabled:opacity-25 hover:border-[#10b981]/40 active:scale-95 transition-all"
                >
                  <ArrowDown size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Min / Max Cards */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Round Size
        </h2>
        <div className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4 mb-3">
            {/* Min Cards */}
            <div>
              <p className="text-xs text-gray-500 text-center mb-2">
                Min Cards
              </p>
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setMinCards((v) => Math.max(1, v - 1))}
                  className="w-8 h-8 rounded-lg bg-[#0f160f] border border-[#2d3d2d] flex items-center justify-center hover:border-[#10b981]/40"
                >
                  <Minus size={14} />
                </button>
                <div className="text-2xl font-bold text-[#10b981]">
                  {minCards}
                </div>
                <button
                  onClick={() => setMinCards((v) => Math.min(maxCards, v + 1))}
                  className="w-8 h-8 rounded-lg bg-[#0f160f] border border-[#2d3d2d] flex items-center justify-center hover:border-[#10b981]/40"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Max Cards */}
            <div>
              <p className="text-xs text-gray-500 text-center mb-2">
                Max Cards
              </p>
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setMaxCards((v) => Math.max(minCards, v - 1))}
                  className="w-8 h-8 rounded-lg bg-[#0f160f] border border-[#2d3d2d] flex items-center justify-center hover:border-[#10b981]/40"
                >
                  <Minus size={14} />
                </button>
                <div className="text-2xl font-bold text-[#10b981]">
                  {maxCards}
                </div>
                <button
                  onClick={() =>
                    setMaxCards((v) => Math.min(13, v + 1))
                  }
                  className="w-8 h-8 rounded-lg bg-[#0f160f] border border-[#2d3d2d] flex items-center justify-center hover:border-[#10b981]/40"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500">
            {numRounds} rounds total ({minCards} → {maxCards} → {minCards})
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={loading}
        className="w-full bg-[#10b981] hover:bg-[#059669] disabled:bg-[#10b981]/30 disabled:text-white/40 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
      >
        {loading ? "Starting..." : "Start Game"}
      </button>
    </div>
  );
}
