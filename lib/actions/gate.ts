"use server";

import { unlockAddGate } from "@/lib/gate";

export type UnlockState = { ok: true } | { error: string } | null;

// Unlock the Quick-Add write gate for this browser by supplying the shared
// secret (CELLAR_ADD_SECRET). Sets the unlock cookie on success.
export async function unlockAdd(_prev: UnlockState, form: FormData): Promise<UnlockState> {
  const secret = String(form.get("secret") ?? "");
  if (!secret) return { error: "Enter the shared secret." };
  const ok = await unlockAddGate(secret);
  return ok ? { ok: true } : { error: "That secret didn't match." };
}
