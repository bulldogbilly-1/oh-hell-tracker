"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ChevronLeft,
  Minus,
  Plus,
  Trophy,
  ChevronRight,
  Eye,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useAdmin } from "../../context/AdminContext";

interface Player {
  id: number;
  name: string;
  color: string;
  elo: number;
}

interface Round {
  id: number;
  round_number: number;
  num_cards: number;
  trump_suit: string;
  dealer_index: number;
  phase: "bidding" | "scoring" | "completed";
}

interface Game {
  id: number;
  status: "active" | "completed";
  player_order: string;
  num_rounds: number;
  current_round: number;
}

interface GameData {
  game: Game;
  players: Player[];
  currentRound: Round | null;
  bids: { player_id: number; bid: number }[];
  tricks: { player_id: number; tricks_won: number; score: number }[];
  scores: { playerId: number; totalScore: number }[];
}

const SUIT_SYMBOLS: Record<string, string> = {
  Spades: "♠",
  Hearts: "♥",
  Diamonds: "♦",
  Clubs: "♣",
  "No Trump": "NT",
};

const SUIT_COLORS: Record<string, string> = {
  Spades: "text-blue-300",
  Hearts: "text-red-400",
  Diamonds: "text-red-400",
  Clubs: "text-blue-300",
  "No Trump": "text-gray-300",
};

function SuitBadge({ suit }: { suit: string }) {
  return (
    <span className={`font-bold text-lg ${SUIT_COLORS[suit] || "text-gray-300"}`}>
      {SUIT_SYMBOLS[suit] || suit}
    </span>
  );
}

function Counter({
  value,
  onChange,
  min = 0,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg bg-[#0f160f] border border-[#2d3d2d] flex items-center justify-center hover:border-[#10b981]/40 active:scale-95 transition-all"
      >
        <Minus size={14} />
      </button>
      <span className="w-8 text-center font-bold text-lg">{value}</span>
      <button
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        className="w-8 h-8 rounded-lg bg-[#0f160f] border border-[#2d3d2d] flex items-center justify-center hover:border-[#10b981]/40 active:scale-95 transition-all"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export default function GamePage() {
  const { isAdmin } = useAdmin();
  const params = useParams();
  const gameId = params.id as string;
  const router = useRouter();

  const [data, setData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidValues, setBidValues] = useState<Record<number, number>>({});
  const [selectedTrump, setSelectedTrump] = useState<string>("");
  const [trickValues, setTrickValues] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [finalStandings, setFinalStandings] = useState<
    Array<{
      playerId: number;
      playerName: string;
      totalScore: number;
      rank: number;
      eloChange: number;
      newElo: number;
    }> | null
  >(null);

  const loadGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      if (!res.ok) throw new Error("Failed to load game");
      const d: GameData = await res.json();
      setData(d);

      // Initialize bid values and trump
      if (d.currentRound?.phase === "bidding") {
        const init: Record<number, number> = {};
        d.players.forEach((p) => {
          init[p.id] = 0;
        });
        setBidValues(init);
        setSelectedTrump(d.currentRound.trump_suit || "");
      }

      // Initialize trick values
      if (d.currentRound?.phase === "scoring") {
        const init: Record<number, number> = {};
        const existingTricks = d.tricks;
        d.players.forEach((p) => {
          const t = existingTricks.find((t) => t.player_id === p.id);
          init[p.id] = t?.tricks_won ?? 0;
        });
        setTrickValues(init);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-gray-500">Game not found</div>
    );
  }

  const { game, players, currentRound, bids, scores } = data;
  const playerIds: number[] = JSON.parse(game.player_order);

  // Bidding order: left of dealer first, dealer last
  const biddingOrder = currentRound
    ? [
        ...playerIds.slice(currentRound.dealer_index + 1),
        ...playerIds.slice(0, currentRound.dealer_index + 1),
      ].map((pid) => players.find((p) => p.id === pid)!)
    : [];

  const dealer = currentRound
    ? players.find(
        (p) => p.id === playerIds[currentRound.dealer_index]
      )
    : null;

  // Sorted scores for leaderboard
  const sortedScores = [...scores].sort(
    (a, b) => b.totalScore - a.totalScore
  );

  const totalBids = Object.values(bidValues).reduce((s, v) => s + v, 0);
  const totalTricks = Object.values(trickValues).reduce((s, v) => s + v, 0);

  // Dealer can't bid if it would make total equal num_cards
  const getDealerForbiddenBid = () => {
    if (!currentRound) return null;
    const dealerPlayer = biddingOrder[biddingOrder.length - 1];
    if (!dealerPlayer) return null;
    const otherBidsTotal = biddingOrder
      .slice(0, -1)
      .reduce((sum, p) => sum + (bidValues[p.id] ?? 0), 0);
    const forbidden = currentRound.num_cards - otherBidsTotal;
    return forbidden >= 0 ? forbidden : null;
  };

  const forbiddenDealerBid = getDealerForbiddenBid();

  const handleSubmitBids = async () => {
    if (!currentRound) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/games/${gameId}/rounds/${currentRound.id}/bids`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bids: bidValues, trumpSuit: selectedTrump }),
        }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      await loadGame();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitTricks = async () => {
    if (!currentRound) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/games/${gameId}/rounds/${currentRound.id}/tricks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tricks: trickValues }),
        }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      await loadGame();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextRound = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/games/${gameId}/rounds`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      await loadGame();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGame = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/games/${gameId}/delete`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || `Server error ${res.status}`);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete game");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCompleteGame = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/games/${gameId}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      const d = await res.json();
      setFinalStandings(d.standings);
      await loadGame();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  // Check if last round is completed (all rounds done)
  const allRoundsComplete =
    game.current_round >= game.num_rounds &&
    currentRound?.phase === "completed";

  // Final standings screen
  if (finalStandings || game.status === "completed") {
    const standings = finalStandings;
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6 pt-2">
          <Link href="/" className="text-gray-400 hover:text-white">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold">Game Complete</h1>
        </div>

        <div className="text-center mb-6">
          <Trophy size={48} className="mx-auto text-yellow-400 mb-2" />
          <p className="text-gray-400 text-sm">Final Standings</p>
        </div>

        {standings && (
          <div className="space-y-3 mb-6">
            {standings.map((s, i) => {
              const player = players.find((p) => p.id === s.playerId);
              return (
                <div
                  key={s.playerId}
                  className={`flex items-center gap-3 p-4 rounded-xl border ${
                    i === 0
                      ? "border-yellow-500/40 bg-yellow-500/10"
                      : "border-[#1f2d1f] bg-[#161b16]"
                  }`}
                >
                  <span
                    className={`text-2xl font-black ${
                      i === 0
                        ? "text-yellow-400"
                        : i === 1
                        ? "text-gray-400"
                        : i === 2
                        ? "text-amber-600"
                        : "text-gray-600"
                    }`}
                  >
                    #{s.rank}
                  </span>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: player?.color || "#888" }}
                  >
                    {s.playerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{s.playerName}</div>
                    <div className="text-xs text-gray-500">
                      {s.totalScore} pts
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#10b981]">
                      {Math.round(s.newElo)} ELO
                    </div>
                    <div
                      className={`text-xs font-semibold ${
                        s.eloChange >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {s.eloChange >= 0 ? "+" : ""}
                      {s.eloChange.toFixed(1)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Show final scores if no standings (game was already completed) */}
        {!standings && (
          <div className="space-y-3 mb-6">
            {sortedScores.map((s, i) => {
              const player = players.find((p) => p.id === s.playerId);
              if (!player) return null;
              return (
                <div
                  key={s.playerId}
                  className={`flex items-center gap-3 p-4 rounded-xl border ${
                    i === 0
                      ? "border-yellow-500/40 bg-yellow-500/10"
                      : "border-[#1f2d1f] bg-[#161b16]"
                  }`}
                >
                  <span className="text-xl font-black text-gray-500">
                    #{i + 1}
                  </span>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{player.name}</div>
                    <div className="text-xs text-gray-500">
                      {s.totalScore} pts
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Link
          href="/"
          className="block w-full text-center bg-[#161b16] border border-[#1f2d1f] text-white font-semibold py-3 rounded-xl hover:border-[#10b981]/40"
        >
          Back to Games
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-[#161b16] border border-[#2d3d2d] rounded-2xl p-5 w-full max-w-xs">
            <h3 className="text-lg font-bold mb-2">Delete Game?</h3>
            <p className="text-sm text-gray-400 mb-4">
              This will permanently delete all rounds and scores.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#2d3d2d] text-gray-400 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGame}
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
      <div className="flex items-center gap-3 mb-4 pt-2">
        <Link href="/" className="text-gray-400 hover:text-white">
          <ChevronLeft size={24} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">
            Round {game.current_round} of {game.num_rounds}
          </h1>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {currentRound && (
              <>
                <span>
                  Trump: <SuitBadge suit={currentRound.trump_suit} />
                </span>
                <span>·</span>
                <span>{currentRound.num_cards} cards</span>
                {dealer && (
                  <>
                    <span>·</span>
                    <span>Dealer: {dealer.name}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-gray-600 hover:text-red-400 transition-colors ml-auto"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Leaderboard */}
      <div className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-3 mb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Scores
        </h2>
        <div className="space-y-1.5">
          {sortedScores.map((s, i) => {
            const player = players.find((p) => p.id === s.playerId);
            if (!player) return null;
            return (
              <div key={s.playerId} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-3">{i + 1}</span>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: player.color }}
                >
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 text-sm">{player.name}</span>
                <span className="font-bold text-[#10b981]">
                  {s.totalScore}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Viewer badge */}
      {!isAdmin && game.status === "active" && (
        <div className="flex items-center gap-2 p-3 bg-[#1f2d1f] border border-[#2d3d2d] rounded-xl mb-4 text-gray-400 text-sm">
          <Eye size={16} />
          <span>Viewing live game — admin controls are hidden</span>
        </div>
      )}

      {/* Phase UI */}
      {isAdmin && currentRound?.phase === "bidding" && (
        <div className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Bidding
          </h2>
          <p className="text-xs text-gray-600 mb-4">
            {currentRound.num_cards} trick{currentRound.num_cards !== 1 ? "s" : ""} available ·{" "}
            {forbiddenDealerBid !== null && (
              <span className="text-amber-400">
                Dealer cannot bid {forbiddenDealerBid}
              </span>
            )}
          </p>

          {/* Trump suit selector */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Trump Suit</p>
            <div className="flex gap-2">
              {[
                { key: "Spades", label: "♠", color: "text-blue-300" },
                { key: "Hearts", label: "♥", color: "text-red-400" },
                { key: "Diamonds", label: "♦", color: "text-red-400" },
                { key: "Clubs", label: "♣", color: "text-blue-300" },
                { key: "No Trump", label: "NT", color: "text-gray-300" },
              ].map((suit) => (
                <button
                  key={suit.key}
                  onClick={() => setSelectedTrump(suit.key)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all ${
                    selectedTrump === suit.key
                      ? "border-[#10b981] bg-[#10b981]/20 text-white"
                      : "border-[#2d3d2d] bg-[#0f160f] hover:border-[#10b981]/40"
                  }`}
                >
                  <span className={selectedTrump === suit.key ? "" : suit.color}>
                    {suit.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {biddingOrder.map((player, idx) => {
              if (!player) return null;
              const isDealer = idx === biddingOrder.length - 1;
              const isForbidden =
                isDealer &&
                forbiddenDealerBid !== null &&
                bidValues[player.id] === forbiddenDealerBid;

              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isForbidden
                      ? "border-red-500/40 bg-red-500/5"
                      : "border-[#2d3d2d] bg-[#0f160f]"
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{player.name}</div>
                    {isDealer && (
                      <div className="text-[10px] text-amber-400">Dealer</div>
                    )}
                    {isForbidden && (
                      <div className="text-[10px] text-red-400">
                        Cannot bid {forbiddenDealerBid}
                      </div>
                    )}
                  </div>
                  <Counter
                    value={bidValues[player.id] ?? 0}
                    onChange={(v) => {
                      setBidValues((prev) => ({ ...prev, [player.id]: v }));
                    }}
                    min={0}
                    max={currentRound.num_cards}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-gray-500 mb-3">
            <span>
              Total bids: <span className="text-white font-bold">{totalBids}</span> /{" "}
              {currentRound.num_cards}
            </span>
            {totalBids === currentRound.num_cards && (
              <span className="text-amber-400">Dealer must adjust</span>
            )}
          </div>

          <button
            onClick={handleSubmitBids}
            disabled={submitting || totalBids === currentRound.num_cards}
            className="w-full bg-[#10b981] hover:bg-[#059669] disabled:bg-[#10b981]/30 disabled:text-white/40 text-white font-bold py-3 rounded-xl transition-colors text-sm"
          >
            {submitting ? "Submitting..." : "Submit Bids"}
          </button>
        </div>
      )}

      {isAdmin && currentRound?.phase === "scoring" && (
        <div className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Tricks Won
          </h2>
          <p className="text-xs text-gray-600 mb-4">
            Enter tricks won · must total {currentRound.num_cards}
          </p>

          <div className="space-y-3">
            {playerIds.map((pid) => {
              const player = players.find((p) => p.id === pid);
              if (!player) return null;
              const bid = bids.find((b) => b.player_id === pid)?.bid ?? 0;
              const tricksWon = trickValues[pid] ?? 0;
              const hit = tricksWon === bid;

              return (
                <div
                  key={pid}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#2d3d2d] bg-[#0f160f]"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{player.name}</div>
                    <div className="text-xs text-gray-500">
                      Bid: <span className="text-white">{bid}</span>
                      {tricksWon === bid ? (
                        <span className="ml-2 text-[#10b981]">+{10 + bid} pts</span>
                      ) : tricksWon > bid ? (
                        <span className="ml-2 text-amber-400">+{tricksWon} pts</span>
                      ) : (
                        <span className="ml-2 text-gray-600">+0 pts</span>
                      )}
                    </div>
                  </div>
                  <Counter
                    value={trickValues[pid] ?? 0}
                    onChange={(v) =>
                      setTrickValues((prev) => ({ ...prev, [pid]: v }))
                    }
                    min={0}
                    max={currentRound.num_cards}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-gray-500 mb-3">
            <span>
              Total:{" "}
              <span
                className={
                  totalTricks === currentRound.num_cards
                    ? "text-[#10b981] font-bold"
                    : "text-white font-bold"
                }
              >
                {totalTricks}
              </span>{" "}
              / {currentRound.num_cards}
            </span>
            {totalTricks !== currentRound.num_cards && (
              <span className="text-red-400">
                {totalTricks < currentRound.num_cards
                  ? `${currentRound.num_cards - totalTricks} remaining`
                  : `${totalTricks - currentRound.num_cards} too many`}
              </span>
            )}
          </div>

          <button
            onClick={handleSubmitTricks}
            disabled={submitting || totalTricks !== currentRound.num_cards}
            className="w-full bg-[#10b981] hover:bg-[#059669] disabled:bg-[#10b981]/30 disabled:text-white/40 text-white font-bold py-3 rounded-xl transition-colors text-sm"
          >
            {submitting ? "Submitting..." : "Submit Results"}
          </button>
        </div>
      )}

      {isAdmin && currentRound?.phase === "completed" && !allRoundsComplete && (
        <div className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm mb-4">
            Round {game.current_round} complete!
          </p>
          <button
            onClick={handleNextRound}
            disabled={submitting}
            className="w-full bg-[#10b981] hover:bg-[#059669] disabled:bg-[#10b981]/30 text-white font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            Next Round <ChevronRight size={16} />
          </button>
        </div>
      )}

      {isAdmin && allRoundsComplete && game.status === "active" && (
        <div className="bg-[#161b16] border border-[#1f2d1f] rounded-xl p-4 text-center">
          <Trophy size={32} className="mx-auto text-yellow-400 mb-3" />
          <p className="text-gray-400 text-sm mb-4">
            All {game.num_rounds} rounds complete! Ready to finalize?
          </p>
          <button
            onClick={handleCompleteGame}
            disabled={submitting}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-500/30 text-black font-bold py-3 rounded-xl transition-colors text-sm"
          >
            {submitting ? "Finalizing..." : "Complete Game & Update ELO"}
          </button>
        </div>
      )}
    </div>
  );
}
