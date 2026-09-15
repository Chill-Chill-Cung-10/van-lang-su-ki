import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dấu Ấn Đại Việt | Hành trình Văn Lang",
  description: "Web game học lịch sử Việt Nam qua hành trình Thành Văn Lang.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#noi-dung-chinh">
          Đi tới nội dung chính
        </a>
        {children}
      </body>
    </html>
  );
}
