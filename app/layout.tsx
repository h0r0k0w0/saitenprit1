import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Mentalizing Scoring Console",
  description: "Compare outputs for GPT-5.2, Claude Opus 4.5, and Gemini 3 Pro."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
