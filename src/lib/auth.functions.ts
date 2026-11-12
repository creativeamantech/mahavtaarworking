import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const loginWithPin = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({
    executiveName: z.string().trim().min(1).max(100),
    pin: z.string().min(1).max(100),
  }).parse(value))
  .handler(async ({ data }) => {
    const { readCredentials, verifyPin, issueToken, setSessionCookie } = await import("./auth.server");
    const user = readCredentials().find((candidate) => candidate.name === data.executiveName);
    if (!user || !verifyPin(data.pin, user.pin)) throw new Error("Executive name or PIN is incorrect.");
    setSessionCookie(issueToken(user), 365 * 24 * 60 * 60);
    return { name: user.name, role: user.role };
  });

export const getCurrentSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionCookie, readCredentials, verifyToken, setSessionCookie } = await import("./auth.server");
  const token = getSessionCookie();
  if (!token) return null;
  const verified = verifyToken(token, readCredentials());
  if (!verified) {
    setSessionCookie("", 0);
    return null;
  }
  return { name: verified.user.name, role: verified.user.role };
});

export const logoutCurrentSession = createServerFn({ method: "POST" }).handler(async () => {
  const { setSessionCookie } = await import("./auth.server");
  setSessionCookie("", 0);
  return { ok: true as const };
});
