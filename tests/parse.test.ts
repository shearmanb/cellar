// Regression suite for the Quick-Add parser (lib/parse.ts).
//
// Run with: npm test
//
// The workflow that makes the parser get better: every time a real paste
// parses badly, add the exact paste here with the fields it *should* produce,
// then fix lib/parse.ts until the suite is green. Cases are cheap — paste in
// the raw text verbatim; never trim it down to what the parser handles today.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePaste, parseBookmarkletPayload } from "@/lib/parse";

const BRANDS = ["Buffalo Trace", "Weller", "E.H. Taylor", "Old Fitzgerald"];

// --- Real paste, reported 2026-07: single-barrel pick spec sheet. The old
// parser kept the whole first line as the name, missed the brand, called it
// Rye (from "36% Rye" — the mashbill is 60% corn → Bourbon), and buried the
// tasting notes under the metadata.
const PENELOPE = `Week 40 – Penelope Estate 10 Year 36% Rye r/Bourbon Single Barrel Selection
Distilled: Indiana
Aged In: Indiana
Bottled In: Indiana
Age: 10 Years
More Info: Single Barrel, No Coloring, No Filtering, No Additives, Barrel Strength
Barrel: PEN24-136
Mashbill: 60% Corn, 36% Rye, 4% Malted Barley
Distilled 12/21/2013
Warehouse/Floor: L-5
ABV:  57% ABV
T8ke’s Tasting Notes: Rich tobacco and creamy toffee, bold cracked pepper meets a hint of char, peppercorns, caramel candies and maple. The palate is viscous and fudgy, savory and sweet with loads of sweet+savory matchups: salted caramel, a hint of bbq and char with toffee, butter cream, brown butter and maple candies. It’s decadent and rich, a touch of espresso and graham cracker. Long finish, packed full of tobacco and toffees all day. `;

test("single-barrel pick spec sheet (Penelope)", () => {
  const p = parsePaste(PENELOPE, BRANDS);
  assert.equal(p.name, "Penelope Estate 10 Year");
  assert.equal(p.brand, "Penelope Estate");
  assert.equal(p.category, "Bourbon"); // mashbill wins over "36% Rye" / "r/Bourbon"
  assert.equal(p.distillery, "Indiana");
  assert.ok(p.notes.startsWith("Rich tobacco and creamy toffee"), "tasting notes lead");
  assert.ok(p.notes.includes("Mashbill: 60% Corn, 36% Rye"), "mashbill preserved");
  assert.ok(p.notes.includes("Age: 10 Years"), "age preserved");
  assert.ok(p.notes.includes("Barrel: PEN24-136"), "barrel id preserved");
});

test("store title with price and size", () => {
  const p = parsePaste(
    "Buffalo Trace Kosher Wheat Recipe Straight Bourbon Whiskey 750ml - $89.99",
    BRANDS
  );
  assert.equal(p.name, "Buffalo Trace Kosher Wheat Recipe Straight Bourbon Whiskey");
  assert.equal(p.brand, "Buffalo Trace"); // known-catalog prefix
  assert.equal(p.msrp, "89.99");
  assert.equal(p.category, "Bourbon");
});

test("explicit Key: value block", () => {
  const p = parsePaste(
    "Name: Weller 12\nBrand: Weller\nPrice: $45\nCodes: W12, weller12\nNotes: hard to find",
    BRANDS
  );
  assert.equal(p.name, "Weller 12");
  assert.equal(p.brand, "Weller");
  assert.equal(p.msrp, "45");
  assert.equal(p.shortcodes, "W12, weller12");
  assert.equal(p.notes, "hard to find");
});

test("Nose/Palate/Finish review keeps its labels in notes", () => {
  const p = parsePaste(
    "Elijah Craig Barrel Proof C923\nNose: dark cherry and oak\nPalate: brown sugar, baking spice\nFinish: long, drying oak",
    BRANDS
  );
  assert.equal(p.name, "Elijah Craig Barrel Proof C923");
  assert.equal(p.brand, "Elijah Craig"); // guessed — stops before "Barrel"
  assert.equal(
    p.notes,
    "Nose: dark cherry and oak\nPalate: brown sugar, baking spice\nFinish: long, drying oak"
  );
});

test("bare 'Single Barrel' in an expression name is not stripped", () => {
  const p = parsePaste("Blanton's Single Barrel Bourbon", BRANDS);
  assert.equal(p.name, "Blanton's Single Barrel Bourbon");
});

test("rye-dominant mashbill → Rye", () => {
  const p = parsePaste("MGP Rye Pick\nMashbill: 95% Rye, 5% Malted Barley", BRANDS);
  assert.equal(p.category, "Rye");
});

test("JSON-LD Product paste", () => {
  const p = parsePaste(
    JSON.stringify({
      "@type": "Product",
      name: "Eagle Rare 10 Year Bourbon",
      brand: { name: "Buffalo Trace" },
      offers: { price: "39.99" },
      image: "http://x/y.jpg",
      description: "Single barrel",
    }),
    BRANDS
  );
  assert.equal(p.name, "Eagle Rare 10 Year Bourbon");
  assert.equal(p.brand, "Buffalo Trace");
  assert.equal(p.msrp, "39.99");
  assert.equal(p.image, "http://x/y.jpg");
});

test("bookmarklet payload: og title cleaned of pick prefix, vendor brand", () => {
  const p = parseBookmarkletPayload(
    JSON.stringify({
      title: "Store",
      url: "http://s/p",
      ogTitle: "Barrel 12 - Smoke Wagon Uncut Unfiltered Single Barrel Selection",
      ogImage: "http://s/i.jpg",
      vendor: "Smoke Wagon",
      price: "59.99",
    }),
    BRANDS
  );
  assert.equal(p.name, "Smoke Wagon Uncut Unfiltered");
  assert.equal(p.brand, "Smoke Wagon");
  assert.equal(p.msrp, "59.99");
  assert.equal(p.url, "http://s/p");
});

test("bookmarklet payload: embedded JSON-LD wins over og title", () => {
  const p = parseBookmarkletPayload(
    JSON.stringify({
      title: "Store",
      url: "http://s/p2",
      ogTitle: "Generic OG Title 750ml",
      ld: JSON.stringify({
        "@type": "Product",
        name: "E.H. Taylor Small Batch",
        offers: { price: "44.99" },
      }),
    }),
    BRANDS
  );
  assert.equal(p.name, "E.H. Taylor Small Batch");
  assert.equal(p.brand, "E.H. Taylor");
  assert.equal(p.msrp, "44.99");
});

test("empty and junk input stay empty", () => {
  assert.equal(parsePaste("", BRANDS).name, "");
  assert.equal(parsePaste("   \n  ", BRANDS).name, "");
});
