import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import getDb from "./db";

const SESSION_COOKIE = "admin_session";
const SESSION_DURATION_DAYS = 30;

export async function createSession(): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await db.execute({
    sql: "DELETE FROM admin_sessions WHERE expires_at < datetime('now')",
    args: [],
  });

  await db.execute({
    sql: "INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)",
    args: [token, expiresAt],
  });

  return token;
}

export async function validateSession(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT id FROM admin_sessions WHERE token = ? AND expires_at > datetime('now')",
    args: [token],
  });
  return result.rows.length > 0;
}

export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "DELETE FROM admin_sessions WHERE token = ?",
    args: [token],
  });
}

export function getSessionToken(request: NextRequest): string | undefined {
  return request.cookies.get(SESSION_COOKIE)?.value;
}

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const token = getSessionToken(request);
  return validateSession(token);
}

export async function requireAdmin(
  request: NextRequest
): Promise<NextResponse | null> {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export function verifyPin(pin: string): boolean {
  const adminPin = process.env.ADMIN_PIN;
  if (!adminPin) return true;
  return pin === adminPin;
}
