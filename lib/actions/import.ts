"use server";

import { prisma } from "@/lib/prisma";
import { parseCsv, CSV_HEADER } from "@/lib/csv";
import { normalizeCode, parseDateValue, parseBoolValue } from "@/lib/serialize";
import { brandKey, applyBrandRule } from "@/lib/brand-rules";
import { revalidatePath } from "next/cache";

export type ImportResult = {
  created: number;
  updated: number;
  errors: string[];
};

function cell(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

// Upserts bottles from CSV. Rows with an id update that bottle (preserving
// the id); rows without an id create new bottles. Shortcodes column is
// semicolon-separated and replaces the bottle's alias set.
export async function importCsv(text: string): Promise<ImportResult> {
  const rows = parseCsv(text);
  if (rows.length === 0) return { created: 0, updated: 0, errors: ["Empty CSV"] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = ["name", "brand"].filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return {
      created: 0,
      updated: 0,
      errors: [
        `Missing required column(s): ${missing.join(", ")}. Expected columns: ${CSV_HEADER.join(", ")}`,
      ],
    };
  }
  const col = (row: string[], name: string) => {
    const i = header.indexOf(name);
    return i === -1 ? null : cell(row[i]);
  };

  const result: ImportResult = { created: 0, updated: 0, errors: [] };

  // Brand rules fill blank fields per row (see lib/brand-rules.ts).
  const rules = await prisma.brandRule.findMany();
  const ruleByKey = new Map(rules.map((r) => [r.brandKey, r]));

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const line = r + 1;
    try {
      const name = col(row, "name");
      const brand = col(row, "brand");
      if (!name || !brand) throw new Error("name and brand are required");
      const idRaw = col(row, "id");
      const id = idRaw === null ? null : Number(idRaw);
      if (id !== null && (!Number.isInteger(id) || id <= 0)) throw new Error(`bad id "${idRaw}"`);
      const msrpRaw = col(row, "msrp");
      const msrp = msrpRaw === null ? null : Number(msrpRaw);
      if (msrp !== null && Number.isNaN(msrp)) throw new Error(`bad msrp "${msrpRaw}"`);

      // An absent/blank ndp cell is "unset" so a brand rule can supply it; a
      // present cell is explicit and always wins.
      const ndpCell = col(row, "ndp");
      const ndpExplicit = ndpCell !== null;
      const data = {
        name,
        brand,
        distillery: col(row, "distillery"),
        category: col(row, "category"),
        tier: col(row, "tier"),
        myTier: col(row, "my_tier"),
        vabcCode: col(row, "vabc_code"),
        ndp: ndpExplicit ? ["1", "true", "yes", "y", "ndp"].includes(ndpCell.toLowerCase()) : false,
        vabcAllocated: parseBoolValue(col(row, "vabc_allocated")),
        addedToVabcAt: parseDateValue(col(row, "added_to_vabc"), "added_to_vabc"),
        firstAppearance: parseDateValue(col(row, "first_appearance"), "first_appearance"),
        msrp,
        warn: col(row, "warn"),
        notes: col(row, "notes"),
        // Only touch displayValue when the column is present, so importing an
        // older CSV (without it) never blanks the Drop Tracker list.
        ...(header.includes("display_value")
          ? { displayValue: col(row, "display_value") }
          : {}),
      };
      applyBrandRule(data, ruleByKey.get(brandKey(brand)), ndpExplicit);
      const codes = Array.from(
        new Set(
          (col(row, "shortcodes") ?? "")
            .split(/[;|]+/)
            .map((c) => normalizeCode(c))
            .filter((c) => c !== "")
        )
      );

      const conflicts = await prisma.alias.findMany({
        where: { code: { in: codes }, ...(id !== null ? { NOT: { bottleId: id } } : {}) },
        include: { bottle: { select: { id: true, name: true } } },
      });
      if (conflicts.length > 0) {
        throw new Error(
          `shortcode conflict: ${conflicts.map((a) => `"${a.code}" already on #${a.bottle.id} ${a.bottle.name}`).join("; ")}`
        );
      }

      if (id !== null) {
        const existing = await prisma.bottle.findUnique({ where: { id } });
        if (existing) {
          await prisma.$transaction([
            prisma.alias.deleteMany({ where: { bottleId: id } }),
            prisma.bottle.update({
              where: { id },
              data: { ...data, aliases: { create: codes.map((code) => ({ code })) } },
            }),
          ]);
          result.updated++;
        } else {
          await prisma.bottle.create({
            data: { id, ...data, aliases: { create: codes.map((code) => ({ code })) } },
          });
          result.created++;
        }
      } else {
        await prisma.bottle.create({
          data: { ...data, aliases: { create: codes.map((code) => ({ code })) } },
        });
        result.created++;
      }
    } catch (e) {
      result.errors.push(`Row ${line}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Explicit ids may have outpaced the sequence; resync so future
  // auto-assigned ids don't collide.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Bottle"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "Bottle"))`
  );

  revalidatePath("/bottles");
  return result;
}
