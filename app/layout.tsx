import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cellar",
  description: "Master bottle database — single source of truth",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/bottles" className="logo">
            🥃 Cellar
          </Link>
          <nav>
            <Link href="/bottles">Bottles</Link>
            <Link href="/bottles/all">All fields</Link>
            <Link href="/pending">Pending</Link>
            <Link href="/dupes">Dupes</Link>
            <Link href="/import">Import</Link>
            <Link href="/control-panel">Control panel</Link>
            <a href="/api/export">Export CSV</a>
          </nav>
          <details className="rickhouse">
            <summary>🏠 RickHouse</summary>
            <div className="rickhouse-menu">
              <span className="rh-app current">
                <span className="rh-name">Cellar</span>
                <span className="rh-tag">Bottle DB</span>
              </span>
              <a className="rh-app" href="https://shearmanb.github.io/beacon/">
                <span className="rh-name">Beacon</span>
                <span className="rh-tag">Tracking</span>
              </a>
              <a className="rh-app" href="https://shearmanb.github.io/drop-tracker/">
                <span className="rh-name">Unicorn Slayer</span>
                <span className="rh-tag">Hunting</span>
              </a>
              <a className="rh-app" href="https://finish-production-0ad6.up.railway.app/">
                <span className="rh-name">Finish</span>
                <span className="rh-tag">Tasting</span>
              </a>
            </div>
          </details>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
