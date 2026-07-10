import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

// Optional shared-secret gate for the operator write path (Quick add). When
// CELLAR_ADD_SECRET is set, adding a bottle from /add requires unlocking with
// that secret once per browser; when it's unset the gate is a no-op and the
// page behaves exactly as before. Reads stay open — this only guards the write.
//
// The gate is enforced server-side (in the quickAddBottle action), so it can't
// be bypassed by posting the action directly. We deliberately do NOT gate the
// page render or redirect: the bookmarklet delivers its payload in the URL
// hash, which never reaches the server, so a redirect would discard it. The
// page loads, prefills from the hash, and the unlock happens inline.
const COOKIE = "cellar_add";

export function addGateEnabled(): boolean {
  return Boolean(process.env.CELLAR_ADD_SECRET);
}

// The cookie stores a hash of the secret, not the secret itself.
function expectedToken(): string {
  return createHash("sha256").update(process.env.CELLAR_ADD_SECRET ?? "").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function isAddUnlocked(): Promise<boolean> {
  if (!addGateEnabled()) return true;
  const jar = await cookies();
  return safeEqual(jar.get(COOKIE)?.value ?? "", expectedToken());
}

// Verify a submitted secret and, on success, set the unlock cookie. Returns
// whether it matched. A no-op success when no secret is configured.
export async function unlockAddGate(secret: string): Promise<boolean> {
  if (!addGateEnabled()) return true;
  if (!safeEqual(secret, process.env.CELLAR_ADD_SECRET ?? "")) return false;
  const jar = await cookies();
  jar.set(COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // ~6 months
  });
  return true;
}
