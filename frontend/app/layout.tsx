import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ople — 나만의 다음 장",
  description:
    "일도, 나도 놓치지 않는 나만의 5년. 세 가지 미래를 그리는 라이프 디자인 저널.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Jua&display=swap"
        />
      </head>
      <body>
        <div className="app-frame">{children}</div>
      </body>
    </html>
  );
}
