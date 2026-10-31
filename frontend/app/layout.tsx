import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Odyssey Voice",
  description: "누르고 말하는 오디세이 인터뷰",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
