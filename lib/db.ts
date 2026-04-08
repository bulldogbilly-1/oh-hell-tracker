import { createClient, Client } from "@libsql/client";

let clientPromise: Promise<Client> | null = null;

async function initializeClient(): Promise<Client> {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL ?? "file:oh-hell.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#8b5cf6',
      elo REAL NOT NULL DEFAULT 1000,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'active',
      player_order TEXT NOT NULL,
      num_rounds INTEGER NOT NULL,
      current_round INTEGER NOT NULL DEFAULT 1,
      min_cards INTEGER NOT NULL DEFAULT 1,
      max_cards INTEGER NOT NULL DEFAULT 7,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      num_cards INTEGER NOT NULL,
      trump_suit TEXT NOT NULL,
      dealer_index INTEGER NOT NULL,
      phase TEXT NOT NULL DEFAULT 'bidding',
      UNIQUE(game_id, round_number)
    );

    CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL REFERENCES rounds(id),
      player_id INTEGER NOT NULL REFERENCES players(id),
      bid INTEGER NOT NULL,
      UNIQUE(round_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS tricks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL REFERENCES rounds(id),
      player_id INTEGER NOT NULL REFERENCES players(id),
      tricks_won INTEGER NOT NULL,
      score INTEGER NOT NULL,
      UNIQUE(round_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS elo_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players(id),
      game_id INTEGER NOT NULL REFERENCES games(id),
      elo_before REAL NOT NULL,
      elo_after REAL NOT NULL,
      elo_change REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations for existing databases
  for (const migration of [
    "ALTER TABLE games ADD COLUMN min_cards INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE games ADD COLUMN max_cards INTEGER NOT NULL DEFAULT 7",
    "ALTER TABLE players ADD COLUMN avatar_url TEXT",
  ]) {
    try {
      await db.execute(migration);
    } catch {
      // Column already exists — ignore
    }
  }

  return db;
}

export function getDb(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = initializeClient();
  }
  return clientPromise;
}

export default getDb;

// Type definitions
export interface Player {
  id: number;
  name: string;
  color: string;
  elo: number;
  created_at: string;
}

export interface Game {
  id: number;
  status: "active" | "completed";
  player_order: string;
  num_rounds: number;
  current_round: number;
  min_cards: number;
  max_cards: number;
  created_at: string;
  completed_at: string | null;
}

export interface Round {
  id: number;
  game_id: number;
  round_number: number;
  num_cards: number;
  trump_suit: string;
  dealer_index: number;
  phase: "bidding" | "scoring" | "completed";
}

export interface Bid {
  id: number;
  round_id: number;
  player_id: number;
  bid: number;
}

export interface Trick {
  id: number;
  round_id: number;
  player_id: number;
  tricks_won: number;
  score: number;
}

export interface EloHistory {
  id: number;
  player_id: number;
  game_id: number;
  elo_before: number;
  elo_after: number;
  elo_change: number;
  created_at: string;
}

// Utility: compute trump suit from round number (0-indexed)
export function getTrumpSuit(roundIndex: number): string {
  const suits = ["Spades", "Hearts", "Diamonds", "Clubs", "No Trump"];
  return suits[roundIndex % suits.length];
}

// Utility: compute cards dealt for a given round number (1-indexed)
// Rounds go: minCards, minCards+1, ..., maxCards, ..., minCards+1, minCards
// Total rounds = 2 * (maxCards - minCards) + 1
export function getNumCardsForRound(
  roundNumber: number,
  maxCards: number,
  minCards: number = 1
): number {
  const midpoint = maxCards - minCards + 1; // round number at which we hit max
  if (roundNumber <= midpoint) {
    return minCards + roundNumber - 1;
  }
  return maxCards - (roundNumber - midpoint);
}

// Utility: total rounds given min and max cards
export function getNumRounds(maxCards: number, minCards: number = 1): number {
  return 2 * (maxCards - minCards) + 1;
}

// Utility: calculate score for a round
// Exact bid: 10 + bid
// Over bid (won more than bid): tricks_won
// Under bid (won fewer than bid): 0
export function calculateScore(bid: number, tricksWon: number): number {
  if (tricksWon === bid) return 10 + bid;
  if (tricksWon > bid) return tricksWon;
  return 0;
}

// Utility: calculate the theoretical maximum score for a game
// Assumes a player bids and wins all cards every round (10 + numCards per round)
export function calculateMaxPossibleScore(maxCards: number, minCards: number = 1): number {
  const numRounds = getNumRounds(maxCards, minCards);
  let maxScore = 0;
  for (let round = 1; round <= numRounds; round++) {
    const numCards = getNumCardsForRound(round, maxCards, minCards);
    maxScore += 10 + numCards;
  }
  return maxScore;
}
