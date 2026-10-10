import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PitchCom ⚾",
  description: "야구 피치컴 실시간 신호 전송",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", backgroundColor: "#0f172a", color: "#f8fafc" }}>
        {children}
      </body>
    </html>
  );
}
