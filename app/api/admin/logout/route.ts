import { NextRequest, NextResponse } from "next/server";
import { getSessionToken, deleteSession, clearSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = getSessionToken(request);
  if (token) {
    await deleteSession(token);
  }
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
