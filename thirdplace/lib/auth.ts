// lib/auth.ts
// Simple client-side auth with localStorage.
// In production, replace with a real backend / JWT.

export type Profile = "Wheelchair" | "Cane" | "Walker" | "Low crowd";
export type TransportMode = "walking" | "transit" | "car";

export interface UserPreferences {
  profile: Profile;
  language: "en" | "fr";
  transportMode: TransportMode;
  voiceEnabled: boolean;
  highContrast: boolean;
  largeText: boolean;
}

export interface User {
  username: string;
  passwordHash: string; // simple hash for demo — use bcrypt in production
  preferences: UserPreferences;
}

const STORAGE_KEY = "waygo_users";
const SESSION_KEY = "waygo_session";

export const DEFAULT_PREFS: UserPreferences = {
  profile: "Wheelchair",
  language: "en",
  transportMode: "walking",
  voiceEnabled: false,
  highContrast: false,
  largeText: false,
};

// Very simple hash — good enough for a hackathon demo
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

function getUsers(): Record<string, User> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function saveUsers(users: Record<string, User>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export function register(username: string, password: string): { ok: boolean; error?: string } {
  const users = getUsers();
  if (users[username.toLowerCase()]) return { ok: false, error: "Username already taken" };
  if (username.length < 2) return { ok: false, error: "Username too short" };
  if (password.length < 4) return { ok: false, error: "Password too short (min 4 chars)" };

  users[username.toLowerCase()] = {
    username,
    passwordHash: simpleHash(password),
    preferences: { ...DEFAULT_PREFS },
  };
  saveUsers(users);
  return { ok: true };
}

export function login(username: string, password: string): { ok: boolean; error?: string } {
  const users = getUsers();
  const user = users[username.toLowerCase()];
  if (!user) return { ok: false, error: "User not found" };
  if (user.passwordHash !== simpleHash(password)) return { ok: false, error: "Wrong password" };

  localStorage.setItem(SESSION_KEY, username.toLowerCase());
  return { ok: true };
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  const users = getUsers();
  return users[username] ?? null;
}

export function savePreferences(prefs: UserPreferences) {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return;
  const users = getUsers();
  if (!users[username]) return;
  users[username].preferences = prefs;
  saveUsers(users);
}

export function isLoggedIn(): boolean {
  return !!getCurrentUser();
}
