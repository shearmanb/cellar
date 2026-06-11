import { prisma } from "@/lib/prisma";
import { toCsv, CSV_HEADER } from "@/lib/csv";

export const dynamic = "force-dynamic";

// CSV export in the same format the importer accepts (round-trippable).
export async function GET() {
  const bottles = await prisma.bottle.findMany({
    include: { aliases: true },
    orderBy: { id: "asc" },
  });
  const rows = bottles.map((b) => [
    b.id,
    b.name,
    b.brand,
    b.distillery,
    b.category,
    b.tier,
    b.myTier,
    b.vabcCode,
    b.msrp === null ? null : Number(b.msrp),
    b.warn,
    b.notes,
    b.aliases.map((a) => a.code).join(";"),
  ]);
  const csv = toCsv([CSV_HEADER, ...rows]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cellar-bottles.csv"`,
    },
  });
}
