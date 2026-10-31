import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ODYSSEY — 나만의 다음 장",
  description:
    "나를 발견하고, 나다운 미래를 그려요. 세 가지 5년의 가능성을 만나는 라이프 디자인 저널.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
