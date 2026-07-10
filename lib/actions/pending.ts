"use server";

import { prisma } from "@/lib/prisma";
import { brandKey, applyBrandRule } from "@/lib/brand-rules";
import { normalizeCode } from "@/lib/serialize";
import { isAddUnlocked } from "@/lib/gate";
import { QUICKADD_STORE } from "@/lib/queue";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import type { PendingBottle } from "@prisma/client";

// Rows with store = QUICKADD_STORE are bookmarklet / paste captures. They carry
// the parsed catalog fields (category/notes/shortcodes; brand in vendor) and are
// triaged from the mobile /queue. They never create a StoreListing mapping —
// that's Beacon's cross-store dedupe layer, meaningless for hand-added bottles.

export type EnqueueState = { ok: true; id: number } | { error: string } | null;
export type TriageResult = { ok: true; bottleId?: number } | { error: string };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function field(form: FormData, name: string): string | null {
  const v = form.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 64);
}

function splitCodes(raw: string | null): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(raw.split(/[\n,;]+/).map((c) => normalizeCode(c)).filter(Boolean))
  );
}

// Add a captured bottle to the review queue. Idempotent on its source URL, so
// re-sending the same product page updates the row instead of duplicating it.
// Gated by CELLAR_ADD_SECRET like the rest of the Quick-Add write path.
export async function enqueuePendingBottle(
  _prev: EnqueueState,
  form: FormData
): Promise<EnqueueState> {
  try {
    if (!(await isAddUnlocked())) {
      return { error: "Locked — enter the shared secret to add to the queue." };
    }
    const title = field(form, "name");
    const vendor = field(form, "brand");
    if (!title || !vendor) return { error: "Name and brand are required." };

    const url = field(form, "sourceUrl");
    const priceRaw = field(form, "msrp");
    const price = priceRaw !== null && !Number.isNaN(Number(priceRaw)) ? Number(priceRaw) : null;
    const data = {
      title,
      vendor,
      url,
      image: field(form, "image"),
      price,
      category: field(form, "category"),
      notes: field(form, "notes"),
      shortcodes: field(form, "shortcodes"),
      status: "PENDING" as const,
    };
    // Stable key from the URL (idempotent re-adds); a random one otherwise.
    const handle = url ? `url:${slugify(url)}` : `paste:${slugify(title)}-${randomUUID().slice(0, 8)}`;

    const pending = await prisma.pendingBottle.upsert({
      where: { store_handle: { store: QUICKADD_STORE, handle } },
      create: { store: QUICKADD_STORE, handle, ...data },
      update: data,
    });
    revalidatePath("/queue");
    revalidatePath("/pending");
    return { ok: true, id: pending.id };
  } catch (e) {
    return { error: msg(e) };
  }
}

// Mint a catalog bottle from a queued row: brand-rule fill-the-blanks and the
// same global shortcode-collision check as the main entry form.
async function mintBottleFromPending(
  p: PendingBottle,
  overrides?: { name?: string | null; brand?: string | null }
) {
  const name = (overrides?.name ?? "").trim() || p.title.trim() || "Unknown";
  const brand = (overrides?.brand ?? "").trim() || (p.vendor ?? "").trim() || "Unknown";
  const data = {
    name,
    brand,
    distillery: null as string | null,
    category: p.category?.trim() || null,
    notes: p.notes?.trim() || null,
    msrp: p.price ?? null,
    ndp: false,
  };
  const rule =
    (await prisma.brandRule.findUnique({ where: { brandKey: brandKey(brand) } })) ?? undefined;
  applyBrandRule(data, rule, false);

  const codes = splitCodes(p.shortcodes);
  if (codes.length > 0) {
    const taken = await prisma.alias.findMany({
      where: { code: { in: codes } },
      include: { bottle: { select: { name: true } } },
    });
    if (taken.length > 0) {
      const list = taken.map((a) => `"${a.code}" (${a.bottle.name})`).join(", ");
      throw new Error(`Shortcode already in use: ${list}`);
    }
  }
  return prisma.bottle.create({
    data: { ...data, aliases: { create: codes.map((code) => ({ code })) } },
  });
}

// Record that a pending row resolved to a bottle. For real store listings this
// also writes the StoreListing mapping Beacon relies on; quick-add rows skip it.
async function linkPendingToBottle(pendingId: number, bottleId: number) {
  const p = await prisma.pendingBottle.findUniqueOrThrow({ where: { id: pendingId } });
  const ops = [];
  if (p.store !== QUICKADD_STORE) {
    ops.push(
      prisma.storeListing.upsert({
        where: { store_handle: { store: p.store, handle: p.handle } },
        create: { store: p.store, handle: p.handle, bottleId, title: p.title, url: p.url },
        update: { bottleId, title: p.title, url: p.url },
      })
    );
  }
  ops.push(
    prisma.pendingBottle.update({
      where: { id: pendingId },
      data: { status: "MATCHED", resolvedBottleId: bottleId },
    })
  );
  await prisma.$transaction(ops);
}

// Match a pending listing to an existing bottle and record the mapping.
export async function matchPending(pendingId: number, bottleId: number) {
  await linkPendingToBottle(pendingId, bottleId);
  revalidatePath("/pending");
}

// Mint a new catalog bottle from a pending listing, then map it. (Desktop
// /pending "create new" — carries the parsed fields through too.)
export async function createBottleFromPending(pendingId: number, form: FormData) {
  const pending = await prisma.pendingBottle.findUniqueOrThrow({ where: { id: pendingId } });
  const bottle = await mintBottleFromPending(pending, {
    name: String(form.get("name") ?? ""),
    brand: String(form.get("brand") ?? ""),
  });
  await linkPendingToBottle(pendingId, bottle.id);
  revalidatePath("/bottles");
  revalidatePath("/pending");
}

// ---- Mobile /queue triage (yes / no / maybe). These return a result instead
// of redirecting, and deliberately do NOT revalidate /queue, so the triage
// client can advance its own card stack without the page resetting under it.

// Yes → mint the bottle (gated: it's the real catalog write).
export async function triageAccept(pendingId: number): Promise<TriageResult> {
  try {
    if (!(await isAddUnlocked())) return { error: "Locked — unlock to add bottles." };
    const p = await prisma.pendingBottle.findUniqueOrThrow({ where: { id: pendingId } });
    const bottle = await mintBottleFromPending(p);
    await linkPendingToBottle(pendingId, bottle.id);
    revalidatePath("/bottles");
    revalidatePath("/pending");
    return { ok: true, bottleId: bottle.id };
  } catch (e) {
    return { error: msg(e) };
  }
}

// Yes, but it's this existing bottle → map to it instead of minting a dupe.
export async function triageMatch(pendingId: number, bottleId: number): Promise<TriageResult> {
  try {
    if (!(await isAddUnlocked())) return { error: "Locked — unlock to add bottles." };
    if (!Number.isInteger(bottleId) || bottleId <= 0) return { error: "Invalid bottle." };
    await linkPendingToBottle(pendingId, bottleId);
    revalidatePath("/pending");
    return { ok: true, bottleId };
  } catch (e) {
    return { error: msg(e) };
  }
}

// Maybe → defer for later; No → discard; Reopen → back to the review pile.
export async function triageMaybe(pendingId: number): Promise<TriageResult> {
  return setStatus(pendingId, "MAYBE");
}
export async function triageIgnore(pendingId: number): Promise<TriageResult> {
  return setStatus(pendingId, "IGNORED");
}
export async function triageReopen(pendingId: number): Promise<TriageResult> {
  return setStatus(pendingId, "PENDING");
}
async function setStatus(pendingId: number, status: "MAYBE" | "IGNORED" | "PENDING"): Promise<TriageResult> {
  try {
    await prisma.pendingBottle.update({ where: { id: pendingId }, data: { status } });
    revalidatePath("/pending");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

// Manual "check stores now" from the pending page.
export async function runStoreSync() {
  const { syncAllStores } = await import("@/lib/sync");
  const results = await syncAllStores();
  revalidatePath("/pending");
  const queued = results.reduce((n, r) => n + r.queued, 0);
  const errors = results.filter((r) => r.error).map((r) => `${r.store}: ${r.error}`);
  const { redirect } = await import("next/navigation");
  redirect(
    `/pending?synced=${queued}${errors.length ? `&syncerror=${encodeURIComponent(errors.join("; "))}` : ""}`
  );
}

export async function ignorePending(pendingId: number) {
  await prisma.pendingBottle.update({
    where: { id: pendingId },
    data: { status: "IGNORED" },
  });
  revalidatePath("/pending");
}
