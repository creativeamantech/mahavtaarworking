import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "mahavtaar_working_auth";
const AUTH_TTL_SECONDS = 365 * 24 * 60 * 60;

export type Role = "Admin" | "Executive";
export type Credential = { name: string; role: Role; pin: string };
type Claims = {
  sub: string; role: Role; iat: number; exp: number; jti: string;
  iss: "mahavtaar-working"; ver: 1;
};

export function readCredentials(): Credential[] {
  const raw = process.env["LOGIN_CREDENTIALS"];
  if (!raw?.trim()) throw new Error("LOGIN_CREDENTIALS secret is not configured.");
  const users: Credential[] = [];
  const seen = new Set<string>();
  for (const [index, line] of raw.split(/[;\\r\\n]+/).entries()) {
    const entry = line.trim();
    if (!entry) continue;
    const parts = entry.split("_");
    if (parts.length !== 3) throw new Error(`Invalid LOGIN_CREDENTIALS entry on line ${index + 1}.`);
    const [name, roleText, pin] = parts.map((part) => part.trim());
    const role = roleText?.toLowerCase();
    if (!name || !pin || (role !== "admin" && role !== "executive"))
      throw new Error(`Invalid LOGIN_CREDENTIALS entry on line ${index + 1}.`);
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate user in LOGIN_CREDENTIALS: ${name}.`);
    seen.add(key);
    users.push({ name, role: role === "admin" ? "Admin" : "Executive", pin });
  }
  if (!users.length) throw new Error("LOGIN_CREDENTIALS contains no users.");
  return users;
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
function signature(value: string, pin: string) {
  return createHmac("sha256", pin).update(value).digest("base64url");
}
export function issueToken(user: Credential) {
  const now = Math.floor(Date.now() / 1000);
  const claims: Claims = {
    sub: user.name, role: user.role, iat: now, exp: now + AUTH_TTL_SECONDS,
    jti: randomBytes(16).toString("hex"), iss: "mahavtaar-working", ver: 1,
  };
  const unsigned = encode({ alg: "HS256", typ: "JWT" }) + "." + encode(claims);
  return unsigned + "." + signature(unsigned, user.pin);
}
export function verifyToken(token: string, users: Credential[]) {
  try {
    if (token.length > 4096) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerPart, claimsPart, signaturePart] = parts;
    if (typeof headerPart !== "string" || typeof claimsPart !== "string" ||
        typeof signaturePart !== "string" || !headerPart || !claimsPart || !signaturePart) return null;
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(claimsPart, "base64url").toString("utf8")) as Partial<Claims>;
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "HS256" || header.typ !== "JWT" ||
      claims.iss !== "mahavtaar-working" || claims.ver !== 1 ||
      typeof claims.sub !== "string" || !claims.sub.trim() ||
      (claims.role !== "Admin" && claims.role !== "Executive") ||
      typeof claims.iat !== "number" || typeof claims.exp !== "number" ||
      typeof claims.jti !== "string" || claims.iat > now + 60 ||
      claims.exp <= now || claims.exp - claims.iat > AUTH_TTL_SECONDS) return null;
    const user = users.find((candidate) => candidate.name === claims.sub && candidate.role === claims.role);
    if (!user?.pin) return null;
    const expected = Buffer.from(signature(headerPart + "." + claimsPart, user.pin), "base64url");
    const supplied = Buffer.from(signaturePart, "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    return { user };
  } catch {
    return null;
  }
}
export function setSessionCookie(value: string, maxAge: number) {
  const options = {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict" as const,
    path: "/",
  };
  if (value) setCookie(COOKIE, value, { ...options, maxAge });
  else deleteCookie(COOKIE, options);
}
export function getSessionCookie() {
  return getCookie(COOKIE) ?? "";
}
export function verifyPin(input: string, stored: string) {
  const expected = createHash("sha256").update(stored).digest();
  const actual = createHash("sha256").update(input).digest();
  return timingSafeEqual(actual, expected);
}
export async function requireSession(requiredRole?: Role) {
  const token = getSessionCookie();
  const verified = token ? verifyToken(token, readCredentials()) : null;
  if (!verified) {
    if (token) setSessionCookie("", 0);
    throw new Error("Authentication required. Please log in again.");
  }
  if (requiredRole && verified.user.role !== requiredRole)
    throw new Error("Administrator access required.");
  return { name: verified.user.name, role: verified.user.role };
}
