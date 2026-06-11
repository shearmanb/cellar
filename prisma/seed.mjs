// Starter seed: a handful of bottles from the Drop Tracker write-up, including
// the known shortcode collisions, so the app demos end-to-end. Skips entirely
// if the Bottle table already has rows. For the real catalog, import your full
// list via /import (CSV) — ids in the CSV are preserved.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const bottles = [
  {
    name: "George T. Stagg Bourbon",
    brand: "Buffalo Trace",
    distillery: "Buffalo Trace",
    category: "Bourbon",
    tier: "S",
    codes: ["gts", "stagg", "georgetstagg"],
  },
  {
    name: "E.H. Taylor Small Batch Bourbon",
    brand: "Buffalo Trace",
    distillery: "Buffalo Trace",
    category: "Bourbon",
    tier: "A",
    codes: ["eht", "ehtsm", "ehtsmall", "eh"],
    warn: "EHT defaults to Small Batch",
  },
  {
    name: "Eagle Rare 10yr Bourbon",
    brand: "Buffalo Trace",
    distillery: "Buffalo Trace",
    category: "Bourbon",
    tier: "A",
    codes: ["er", "er10", "eaglerare"],
    warn: "ER = Eagle Rare 10yr (no 17yr at VA ABC)",
  },
  {
    name: "Old Fitzgerald 1924 Bourbon",
    brand: "Old Fitzgerald",
    distillery: "Heaven Hill",
    category: "Bourbon",
    tier: "S",
    codes: ["ofitz1924"],
    warn: "OF1924 is ambiguous — use OFitz1924 (Heaven Hill) vs OFo1924 (Brown-Forman)",
  },
  {
    name: "Old Forester 1924 Bourbon",
    brand: "Old Forester",
    distillery: "Brown-Forman",
    category: "Bourbon",
    tier: "A",
    codes: ["ofo1924"],
    warn: "OF1924 is ambiguous — use OFo1924 (Brown-Forman) vs OFitz1924 (Heaven Hill)",
  },
  {
    name: "Michter's Toasted Barrel Finish Bourbon",
    brand: "Michter's",
    category: "Bourbon",
    tier: "A",
    codes: ["michterstoasted"],
    warn: "MTBF historically collided with Penelope Toasted — avoid",
  },
  {
    name: "Penelope Toasted Bourbon",
    brand: "Penelope",
    category: "Bourbon",
    tier: "B",
    codes: ["penelopetoasted", "pentoasted"],
    warn: "MTBF historically collided with Michter's Toasted — avoid",
  },
  {
    name: "Russell's Reserve Single Barrel Bourbon",
    brand: "Russell's Reserve",
    distillery: "Wild Turkey",
    category: "Bourbon",
    tier: "A",
    codes: ["rr", "rrsib", "russells"],
    warn: "RR = Russell's Reserve (never Rabbit Hole)",
  },
  {
    name: "Unidentified / Unknown",
    brand: "—",
    category: "Other",
    codes: ["unknown"],
    notes: "Catch-all for unmatched tokens",
  },
];

const existing = await prisma.bottle.count();
if (existing > 0) {
  console.log(`Bottle table already has ${existing} rows — skipping seed.`);
} else {
  for (const { codes, ...data } of bottles) {
    await prisma.bottle.create({
      data: { ...data, aliases: { create: codes.map((code) => ({ code })) } },
    });
  }
  console.log(`Seeded ${bottles.length} starter bottles.`);
}

await prisma.$disconnect();
