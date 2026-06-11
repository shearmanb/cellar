"use server";

import { prisma } from "@/lib/prisma";
import { normalizeCode } from "@/lib/serialize";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FormState = { error: string } | null;

function clean(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function parseShortcodes(raw: string | null): string[] {
  if (!raw) return [];
  const codes = raw
    .split(/[\n,;]+/)
    .map((c) => normalizeCode(c))
    .filter((c) => c !== "");
  return Array.from(new Set(codes));
}

function bottleData(form: FormData) {
  const name = clean(form.get("name"));
  const brand = clean(form.get("brand"));
  if (!name || !brand) throw new Error("Name and brand are required");
  const msrpRaw = clean(form.get("msrp"));
  const msrp = msrpRaw === null ? null : Number(msrpRaw);
  if (msrp !== null && Number.isNaN(msrp)) throw new Error("MSRP must be a number");
  return {
    name,
    brand,
    distillery: clean(form.get("distillery")),
    category: clean(form.get("category")),
    tier: clean(form.get("tier")),
    myTier: clean(form.get("myTier")),
    vabcCode: clean(form.get("vabcCode")),
    msrp,
    warn: clean(form.get("warn")),
    notes: clean(form.get("notes")),
  };
}

async function assertCodesAvailable(codes: string[], bottleId?: number) {
  const taken = await prisma.alias.findMany({
    where: { code: { in: codes }, ...(bottleId ? { NOT: { bottleId } } : {}) },
    include: { bottle: { select: { name: true } } },
  });
  if (taken.length > 0) {
    const list = taken.map((a) => `"${a.code}" (${a.bottle.name})`).join(", ");
    throw new Error(`Shortcode already in use: ${list}`);
  }
}

export async function createBottle(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const data = bottleData(form);
    const codes = parseShortcodes(clean(form.get("shortcodes")));
    await assertCodesAvailable(codes);
    await prisma.bottle.create({
      data: { ...data, aliases: { create: codes.map((code) => ({ code })) } },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/bottles");
  redirect("/bottles");
}

export async function updateBottle(
  id: number,
  _prev: FormState,
  form: FormData
): Promise<FormState> {
  try {
    const data = bottleData(form);
    const codes = parseShortcodes(clean(form.get("shortcodes")));
    await assertCodesAvailable(codes, id);
    await prisma.$transaction([
      prisma.alias.deleteMany({ where: { bottleId: id } }),
      prisma.bottle.update({
        where: { id },
        data: { ...data, aliases: { create: codes.map((code) => ({ code })) } },
      }),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/bottles");
  redirect("/bottles");
}

// Soft-archive only: ids are foreign keys in other apps and must never vanish.
export async function setArchived(id: number, archived: boolean) {
  await prisma.bottle.update({ where: { id }, data: { isArchived: archived } });
  revalidatePath("/bottles");
}

export async function addRelease(bottleId: number, form: FormData) {
  const year = clean(form.get("year"));
  const batch = clean(form.get("batch"));
  const label = clean(form.get("label"));
  if (!year && !batch && !label) return;
  await prisma.release.create({ data: { bottleId, year, batch, label } });
  revalidatePath(`/bottles/${bottleId}/edit`);
}

export async function deleteRelease(bottleId: number, releaseId: number) {
  await prisma.release.delete({ where: { id: releaseId } });
  revalidatePath(`/bottles/${bottleId}/edit`);
}
