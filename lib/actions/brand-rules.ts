"use server";

import { prisma } from "@/lib/prisma";
import { brandKey } from "@/lib/brand-rules";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function clean(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

// "" → null (rule leaves NDP untouched), "yes" → true, "no" → false.
function parseNdpRule(v: FormDataEntryValue | null): boolean | null {
  return v === "yes" ? true : v === "no" ? false : null;
}

// Create or update a brand rule. An `id` field means update; otherwise create.
// brandKey is recomputed from the brand and must stay unique.
export async function saveBrandRule(form: FormData) {
  const idRaw = clean(form.get("id"));
  const brand = clean(form.get("brand"));
  if (!brand) redirect("/control-panel?ruleError=Brand+is+required");

  const data = {
    brand,
    brandKey: brandKey(brand),
    distillery: clean(form.get("distillery")),
    category: clean(form.get("category")),
    ndp: parseNdpRule(form.get("ndp")),
  };

  try {
    if (idRaw) {
      await prisma.brandRule.update({ where: { id: Number(idRaw) }, data });
    } else {
      await prisma.brandRule.create({ data });
    }
  } catch {
    redirect(`/control-panel?ruleError=A+rule+for+"${encodeURIComponent(brand)}"+already+exists`);
  }
  revalidatePath("/control-panel");
  redirect("/control-panel?ruleSaved=1");
}

export async function deleteBrandRule(id: number) {
  await prisma.brandRule.delete({ where: { id } });
  revalidatePath("/control-panel");
  redirect("/control-panel?ruleDeleted=1");
}

// Apply every rule to existing bottles as fill-the-blanks: distillery/category
// only where blank, NDP wherever the rule specifies one. Returns via redirect
// with the number of bottles touched.
export async function backfillBrandRules() {
  const rules = await prisma.brandRule.findMany();
  const ruleByKey = new Map(rules.map((r) => [r.brandKey, r]));
  if (ruleByKey.size === 0) redirect("/control-panel?backfilled=0");

  const bottles = await prisma.bottle.findMany({
    select: { id: true, brand: true, distillery: true, category: true, ndp: true },
  });

  let changed = 0;
  for (const b of bottles) {
    const rule = ruleByKey.get(brandKey(b.brand));
    if (!rule) continue;
    const patch: { distillery?: string; category?: string; ndp?: boolean } = {};
    if (b.distillery == null && rule.distillery != null) patch.distillery = rule.distillery;
    if (b.category == null && rule.category != null) patch.category = rule.category;
    if (rule.ndp != null && b.ndp !== rule.ndp) patch.ndp = rule.ndp;
    if (Object.keys(patch).length === 0) continue;
    await prisma.bottle.update({ where: { id: b.id }, data: patch });
    changed++;
  }

  revalidatePath("/bottles");
  revalidatePath("/control-panel");
  redirect(`/control-panel?backfilled=${changed}`);
}
