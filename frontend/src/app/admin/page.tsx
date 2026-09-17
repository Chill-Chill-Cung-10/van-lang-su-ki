import Link from "next/link";

const modules = [
  ["Kho tri thức", "Quản lý tài liệu lịch sử đã được giáo viên kiểm duyệt."],
  ["Ngân hàng câu hỏi", "Soạn, duyệt và phát hành câu hỏi theo Knowledge ID."],
  ["Theo dõi demo", "Xem trạng thái dịch vụ, lượt chơi và lỗi gần nhất."],
];

export default function AdminPage() {
  return (
    <main id="noi-dung-chinh" className="page-shell">
      <header>
        <p className="eyebrow">Admin mini</p>
        <h1>Trung tâm nội dung</h1>
        <p>
          Khung quản trị Version 0. Quyền truy cập và quy trình duyệt nội dung sẽ được bổ sung khi
          cơ chế xác thực được chốt.
        </p>
      </header>
      <section className="admin-grid" aria-label="Các phân hệ quản trị">
        <article>
          <h2>Editor Mode</h2>
          <p>Chỉnh scene, vùng đi được và collider của map đang hoạt động.</p>
          <Link className="button button-secondary" href="/admin/maps">Mở Map Editor</Link>
        </article>
        {modules.map(([title, description]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
            <button className="button button-secondary" type="button" disabled aria-disabled="true">
              Sắp triển khai
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
