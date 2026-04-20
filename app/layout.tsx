import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "그룹 캘린더",
  description: "팀 일정 관리 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full" style={{ colorScheme: "light" }}>
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
