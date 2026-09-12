import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dấu Ấn Đại Việt AI",
  description: "MVP game hóa học lịch sử Việt Nam với gia sư AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#noi-dung-chinh">
          Đi tới nội dung chính
        </a>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="Dấu Ấn Đại Việt AI - Trang chủ">
            <span className="brand-mark" aria-hidden="true">ĐV</span>
            <span>Dấu Ấn Đại Việt AI</span>
          </Link>
          <nav aria-label="Điều hướng chính">
            <Link href="/">Khám phá</Link>
            <Link href="/avatar">Avatar 3D</Link>
            <Link href="/admin">Quản trị</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
