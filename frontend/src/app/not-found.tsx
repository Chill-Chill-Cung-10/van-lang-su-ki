import Link from "next/link";

export default function NotFound() {
  return (
    <main id="noi-dung-chinh" className="page-shell">
      <header>
        <p className="eyebrow">404</p>
        <h1>Chưa tìm thấy dấu ấn này</h1>
        <p>Đường dẫn có thể đã thay đổi hoặc nội dung chưa được phát hành.</p>
        <Link className="button button-primary" href="/">Quay về trang chủ</Link>
      </header>
    </main>
  );
}
