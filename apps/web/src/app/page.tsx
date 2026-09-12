import Link from "next/link";
import { GameShell } from "./_components/game-shell";

const stats = [
  ["12", "tòa thành"],
  ["42%", "thông thạo"],
  ["720", "điểm kinh nghiệm"],
];

export default function HomePage() {
  return (
    <main id="noi-dung-chinh">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Hành trình lịch sử tương tác</p>
          <h1 id="hero-title">Mỗi dấu ấn mở ra một thời đại</h1>
          <p className="hero-lead">
            Khám phá lịch sử Việt Nam qua nhiệm vụ 2D, thử thách kiến thức và một gia sư AI
            sử dụng nguồn nội dung đã kiểm duyệt.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#nhiem-vu-mau">Bắt đầu nhiệm vụ</a>
            <Link className="button button-secondary" href="/avatar">Xem avatar 3D</Link>
          </div>
          <dl className="stats" aria-label="Tiến trình người chơi mẫu">
            {stats.map(([value, label]) => (
              <div key={label}>
                <dt>{value}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="mission-card" aria-label="Nhiệm vụ đang mở">
          <div className="mission-art" aria-hidden="true">
            <span className="sun" />
            <span className="mountain mountain-back" />
            <span className="mountain mountain-front" />
            <span className="river" />
          </div>
          <div className="mission-content">
            <span className="status-badge">Đang mở</span>
            <p className="mission-kicker">Chương mẫu</p>
            <h2>Bạch Đằng năm 938</h2>
            <p>Điều khiển chiến thuyền, nhận diện địa hình và trả lời đúng để tạo thế trận.</p>
          </div>
        </aside>
      </section>

      <section className="section" id="nhiem-vu-mau" aria-labelledby="game-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Prototype Phaser</p>
            <h2 id="game-title">Nhiệm vụ điều hướng chiến thuyền</h2>
          </div>
          <p>Dùng phím mũi tên hoặc WASD. Trên điện thoại, dùng cụm điều khiển bên dưới.</p>
        </div>
        <GameShell />
      </section>

      <section className="section feature-grid" aria-label="Nền tảng Version 0">
        <article>
          <span className="feature-index">01</span>
          <h2>Học qua hành động</h2>
          <p>Nhiệm vụ, câu hỏi và phản hồi được gắn với cùng một mạch lịch sử.</p>
        </article>
        <article>
          <span className="feature-index">02</span>
          <h2>Backend nhẹ</h2>
          <p>API routes giữ khóa bí mật ở máy chủ và kết nối hạ tầng local qua adapter.</p>
        </article>
        <article>
          <span className="feature-index">03</span>
          <h2>3D có chọn lọc</h2>
          <p>Avatar chỉ tải ở màn cần thiết, với fallback tĩnh cho thiết bị yếu.</p>
        </article>
      </section>
    </main>
  );
}
