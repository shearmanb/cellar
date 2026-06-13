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
            <Link href="/pending">Pending</Link>
            <Link href="/import">Import</Link>
            <Link href="/control-panel">Control panel</Link>
            <a href="/api/export">Export CSV</a>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
