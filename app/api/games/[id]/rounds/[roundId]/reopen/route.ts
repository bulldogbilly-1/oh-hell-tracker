import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { id, roundId } = await params;
    const gameId = parseInt(id);
    const roundIdNum = parseInt(roundId);
    const { phase } = await request.json();

    if (phase !== "bidding" && phase !== "scoring") {
      return NextResponse.json(
        { error: "phase must be 'bidding' or 'scoring'" },
        { status: 400 }
      );
    }

    const db = await getDb();

    const roundResult = await db.execute({
      sql: "SELECT * FROM rounds WHERE id = ? AND game_id = ?",
      args: [roundIdNum, gameId],
    });
    if (roundResult.rows.length === 0) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    if (phase === "bidding") {
      // Clear bids and reset phase to bidding
      await db.batch(
        [
          {
            sql: "DELETE FROM bids WHERE round_id = ?",
            args: [roundIdNum],
          },
          {
            sql: "UPDATE rounds SET phase = 'bidding' WHERE id = ?",
            args: [roundIdNum],
          },
        ],
        "write"
      );
    } else {
      // Clear tricks and reset phase to scoring
      await db.batch(
        [
          {
            sql: "DELETE FROM tricks WHERE round_id = ?",
            args: [roundIdNum],
          },
          {
            sql: "UPDATE rounds SET phase = 'scoring' WHERE id = ?",
            args: [roundIdNum],
          },
        ],
        "write"
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to reopen round" }, { status: 500 });
  }
}
