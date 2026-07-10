"use client";

import { useEffect, useRef, useState } from "react";

// Builds the bookmarklet for whatever origin Cellar is currently served from,
// so it points at the right domain in dev, on Railway, or behind a custom
// domain — no hardcoded URL. The bookmarklet only reads the current page and
// opens Cellar's /add page with the data in the URL hash (no cross-origin
// fetch, no injected <script>), which is why it survives most sites' CSP.
function buildBookmarklet(origin: string): string {
  return (
    "javascript:(function(){try{" +
    "var q=function(s){var m=document.querySelector(s);return m?(m.getAttribute('content')||''):'';};" +
    "var sel=window.getSelection?String(window.getSelection()):'';" +
    "var ld='';var n=document.querySelector('script[type=\"application/ld+json\"]');if(n){ld=n.textContent||'';}" +
    "var d={title:document.title||'',url:location.href,selection:sel," +
    "ogTitle:q('meta[property=\"og:title\"]'),ogImage:q('meta[property=\"og:image\"]')," +
    "price:q('meta[property=\"product:price:amount\"]')||q('meta[itemprop=\"price\"]')," +
    "vendor:q('meta[property=\"product:brand\"]')||q('meta[property=\"og:brand\"]')," +
    "ld:ld.length>6000?'':ld};" +
    "window.open('" +
    origin +
    "/add#p='+encodeURIComponent(JSON.stringify(d)),'_blank','noopener');" +
    "}catch(e){window.open('" +
    origin +
    "/add','_blank');}})();"
  );
}

export function BookmarkletLink() {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const bm = buildBookmarklet(window.location.origin);
    setCode(bm);
    // Set the href directly — React strips `javascript:` hrefs, but a real
    // bookmarklet needs one to be draggable to the bookmarks bar.
    linkRef.current?.setAttribute("href", bm);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the textarea below is selectable as a fallback */
    }
  }

  return (
    <div>
      <p>
        <a ref={linkRef} className="btn" draggable style={{ display: "inline-block" }}>
          🥃 Add to Cellar
        </a>{" "}
        <span className="muted">← drag this to your bookmarks bar</span>
      </p>

      <div className="field full" style={{ maxWidth: 720, marginTop: "1rem" }}>
        <label htmlFor="bmcode">…or create a bookmark manually with this as the URL</label>
        <textarea
          id="bmcode"
          readOnly
          rows={4}
          value={code}
          onFocus={(e) => e.currentTarget.select()}
          style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}
        />
        <div className="actions" style={{ marginTop: "0.5rem" }}>
          <button type="button" onClick={copy} disabled={!code}>
            {copied ? "Copied ✓" : "Copy code"}
          </button>
        </div>
      </div>
    </div>
  );
}
