import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hodoki | みんなの会計ノート",
  description: "負担の違いも、明細ごとの割合も、すっきり整う共有会計ノート。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
