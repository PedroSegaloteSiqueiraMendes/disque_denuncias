import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Focus | Canal de Ética", description: "Canal de Ética Focus Solutions" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
