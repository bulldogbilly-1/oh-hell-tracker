"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { useAdmin } from "../context/AdminContext";

interface Player {
  id: number;
  name: string;
  color: string;
  elo: number;
}

export default function PlayersPage() {
  const { isAdmin } = useAdmin();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const loadPlayers = () => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((data) => {
        setPlayers(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setNewName("");
      setShowAdd(false);
      loadPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
          <div className="flex items-center gap-2">
            <Users size={20} className="text-[#10b981]" />
            <h1 className="text-2xl font-bold">Players</h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{players.length} registered</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add
          </button>
        )}
      </div>

      {/* Add player modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center max-w-[430px] mx-auto left-1/2 -translate-x-1/2">
          <div className="w-full bg-[#161b16] border-t border-[#2d3d2d] rounded-t-2xl p-5">
            <h3 className="text-lg font-bold mb-4">Add Player</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Player name"
              autoFocus
              className="w-full bg-[#0f160f] border border-[#2d3d2d] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#10b981] mb-3"
            />
            {error && (
              <p className="text-red-400 text-sm mb-3">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAdd(false);
                  setNewName("");
                  setError("");
                }}
                className="flex-1 py-3 rounded-xl border border-[#2d3d2d] text-gray-400 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                className="flex-1 py-3 rounded-xl bg-[#10b981] hover:bg-[#059669] disabled:bg-[#10b981]/30 text-white font-bold text-sm"
              >
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Players list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : players.length === 0 ? (
        <div className="text-center py-16">
          <Users size={40} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">No players yet</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-block mt-4 text-[#10b981] text-sm font-semibold"
          >
            Add your first player
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {players.map((p) => (
            <Link key={p.id} href={`/players/${p.id}`}>
              <div className="flex items-center gap-3 p-3 bg-[#161b16] border border-[#1f2d1f] rounded-xl hover:border-[#10b981]/40 transition-all active:scale-[0.98]">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-lg"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{p.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[#10b981] font-bold text-sm">
                    {Math.round(p.elo)}
                  </div>
                  <div className="text-[10px] text-gray-600">ELO</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
