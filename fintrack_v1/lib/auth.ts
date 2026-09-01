// lib/auth.ts
import bcrypt from "bcrypt";
import crypto from "crypto";
import { AuthAdapter } from "./db-adapter";
import { cookies } from "next/headers";

const SALT_ROUNDS = 10;
const SESSION_DURATION_DAYS = 7;
const SESSION_COOKIE_NAME = "session_token";

export interface User {
  id: number;
  username: string;
  email: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  is_active: number;
  created_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: string;
  created_at: string;
}

export interface SessionWithUser extends Session {
  user: User;
}

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate a cryptographically secure session token
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Create a new session for a user (deletes all existing sessions for single-device login)
export async function createSession(userId: number): Promise<string> {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  // Use AuthAdapter to support dual database strategy
  await AuthAdapter.createSession(userId, sessionToken, expiresAt.toISOString());

  return sessionToken;
}

// Get session by token and validate expiration
export async function getSessionByToken(token: string): Promise<SessionWithUser | null> {
  // Use AuthAdapter to support dual database strategy
  const session = await AuthAdapter.getSessionByToken(token);
  return session as SessionWithUser | null;
}

// Delete a session (logout)
export async function deleteSession(token: string): Promise<void> {
  // Use AuthAdapter to support dual database strategy
  await AuthAdapter.deleteSession(token);
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<void> {
  // Use AuthAdapter to support dual database strategy
  await AuthAdapter.cleanupExpiredSessions();
}

// Verify user credentials and return user if valid
export async function verifyUserCredentials(
  username: string,
  password: string
): Promise<User | null> {
  // Use AuthAdapter to support dual database strategy
  const user = await AuthAdapter.getUserByUsername(username) as any;

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password_hash);

  if (!isValid) {
    return null;
  }

  // Remove password_hash from returned user object
  const { password_hash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// Get current session from cookies
export async function getCurrentSession(): Promise<SessionWithUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return getSessionByToken(token);
}

// Get current user from session
export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}
