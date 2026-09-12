"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="noi-dung-chinh" className="page-shell">
      <header>
        <p className="eyebrow">Có lỗi xảy ra</p>
        <h1>Hành trình đang tạm gián đoạn</h1>
        <p>Dữ liệu của bạn chưa bị mất. Hãy thử tải lại phần này.</p>
        <button className="button button-primary" type="button" onClick={reset}>Thử lại</button>
      </header>
    </main>
  );
}
