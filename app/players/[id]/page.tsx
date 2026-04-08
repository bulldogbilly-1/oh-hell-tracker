"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Zap, AlertTriangle, Camera } from "lucide-react";
import { useRef } from "react";
import { useAdmin } from "../../context/AdminContext";
import PlayerAvatar from "../../components/PlayerAvatar";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Player {
  id: number;
  name: string;
  color: string;
  elo: number;
  avatar_url?: string | null;
}

interface Stats {
  games: number;
  wins: number;
  winRate: number;
  avgBid: number;
  accuracy: number;
  overbidPct: number;
  underbidPct: number;
  avgPlace: number;
  elo: number;
}

interface EloPoint {
  game_id: number;
  elo_before: number;
  elo_after: number;
  elo_change: number;
  game_date: string;
}

interface ScoutingItem {
  type: "strength" | "weakness";
  title: string;
  description: string;
}

interface PlayerData {
  player: Player;
  stats: Stats;
  eloHistory: EloPoint[];
  scoutingReport: ScoutingItem[];
}

export default function PlayerDetailPage() {
  const params = useParams();
  const playerId = params.id as string;
  const { isAdmin } = useAdmin();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch(`/api/players/${playerId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [playerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading...
      </div>
    );
  }
  if (!data) {
    return <div className="p-4 text-center text-gray-500">Player not found</div>;
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/players/${playerId}/avatar`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const d = await res.json();
        setData((prev) =>
          prev ? { ...prev, player: { ...prev.player, avatar_url: d.avatarUrl } } : prev
        );
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const { player, stats, eloHistory, scoutingReport } = data;

  // Build chart data: start point + history
  const chartData: { game: number; elo: number }[] = [];
  if (eloHistory.length > 0) {
    chartData.push({ game: 0, elo: eloHistory[0].elo_before });
    eloHistory.forEach((h, i) => {
      chartData.push({ game: i + 1, elo: Math.round(h.elo_after) });
    });
  } else {
    chartData.push({ game: 0, elo: Math.round(player.elo) });
  }

  const strengths = scoutingReport.filter((s) => s.type === "strength");
  const weaknesses = scoutingReport.filter((s) => s.type === "weakness");

  return (
    <div className="p-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        <Link href="/players" className="text-gray-400 hover:text-white">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold">Player Profile</h1>
      </div>

      {/* Player card */}
      <div className="bg-[#161b16] border border-[#1f2d1f] rounded-2xl p-5 mb-4 flex items-center gap-4">
        <div className="relative">
          <PlayerAvatar
            name={player.name}
            color={player.color}
            avatarUrl={player.avatar_url}
            size="w-16 h-16"
            fontSize="text-2xl font-black"
          />
          {isAdmin && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
            >
              <Camera size={20} className="text-white" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{player.name}</h2>
          <p className="text-[#10b981] font-bold text-lg">
            {Math.round(player.elo)} ELO
          </p>
          {uploading && <p className="text-xs text-gray-500 mt-0.5">Uploading...</p>}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Games", value: stats.games },
          { label: "Wins", value: stats.wins },
          { label: "Win Rate", value: `${stats.winRate}%` },
          { label: "Accuracy", value: `${stats.accuracy}%` },
          { label: "Overbid %", value: `${stats.overbidPct}%` },
          { label: "Underbid %", value: `${stats.underbidPct}%` },
          {
            label: "Avg Bid",
            value: stats.avgBid ? stats.avgBid.toFixed(1) : "—",
          },
          {
            label: "Avg Place",
            value: stats.avgPlace ? `#${stats.avgPlace.toFixed(1)}` : "—",
          },
          { label: "ELO", value: Math.round(stats.elo) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-3 text-center"
          >
            <div className="text-xl font-bold text-[#10b981]">{value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ELO History Chart */}
      {eloHistory.length > 0 && (
        <div className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            ELO History
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <XAxis
                dataKey="game"
                tick={{ fill: "#6b7280", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "Game",
                  position: "insideBottom",
                  fill: "#4b5563",
                  fontSize: 10,
                }}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a2a1a",
                  border: "1px solid #2d3d2d",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(value) => [value, "ELO"]}
                labelFormatter={(label) => `Game ${label}`}
              />
              <ReferenceLine y={1000} stroke="#374151" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="elo"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#34d399" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Scouting Report */}
      <div className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Scouting Report
        </h3>

        {strengths.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-[#10b981] font-semibold mb-2 flex items-center gap-1">
              <Zap size={12} /> Strengths
            </div>
            <div className="space-y-2">
              {strengths.map((s, i) => (
                <div
                  key={i}
                  className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg p-3"
                >
                  <div className="text-sm font-semibold text-[#10b981] mb-0.5">
                    {s.title}
                  </div>
                  <div className="text-xs text-gray-400">{s.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {weaknesses.length > 0 && (
          <div>
            <div className="text-xs text-amber-400 font-semibold mb-2 flex items-center gap-1">
              <AlertTriangle size={12} /> Weaknesses
            </div>
            <div className="space-y-2">
              {weaknesses.map((s, i) => (
                <div
                  key={i}
                  className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3"
                >
                  <div className="text-sm font-semibold text-amber-400 mb-0.5">
                    {s.title}
                  </div>
                  <div className="text-xs text-gray-400">{s.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
