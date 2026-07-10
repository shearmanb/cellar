import { BookmarkletLink } from "@/components/bookmarklet-link";

export const metadata = { title: "Cellar — Bookmarklet" };

export default function BookmarkletPage() {
  return (
    <>
      <h1>Cellar bookmarklet</h1>
      <p className="muted" style={{ maxWidth: 720 }}>
        A one-click way to grab whatever bottle, product, or notes you&apos;re looking at and drop
        it into your review queue. Install it once, then click it on any page.
      </p>

      <BookmarkletLink />

      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>How it works</h2>
      <ol className="muted" style={{ maxWidth: 720, lineHeight: 1.7 }}>
        <li>
          Drag the <strong>🥃 Add to Cellar</strong> button above onto your browser&apos;s
          bookmarks bar (or make a new bookmark and paste the code as its URL).
        </li>
        <li>
          On a store product page, tasting note, or anywhere else, optionally{" "}
          <strong>select the text</strong> you care about, then click the bookmarklet.
        </li>
        <li>
          It opens Cellar&apos;s <a href="/add">Quick add</a> page with the name, brand, price,
          and image already filled in from the page&apos;s title, Open Graph tags, and structured
          product data. Review and hit <strong>Add to queue</strong>, then approve it later from
          the <a href="/queue">Queue</a> on your phone.
        </li>
      </ol>

      <p className="muted" style={{ maxWidth: 720 }}>
        Some sites block bookmarklets with a strict content-security policy. If nothing happens
        when you click it, just copy the product title (or any text) and paste it into{" "}
        <a href="/add">Quick add</a> directly — the parser handles that the same way.
      </p>
    </>
  );
}
