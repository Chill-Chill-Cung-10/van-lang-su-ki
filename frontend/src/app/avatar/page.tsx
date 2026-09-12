"use client";

import dynamic from "next/dynamic";

const AvatarPreview = dynamic(
  () => import("./avatar-preview").then((module) => module.AvatarPreview),
  {
    ssr: false,
    loading: () => <div className="avatar-stage" role="status" aria-label="Đang tải mô hình 3D" />,
  },
);

export default function AvatarPage() {
  return (
    <main id="noi-dung-chinh" className="page-shell">
      <header>
        <p className="eyebrow">3D tải theo nhu cầu</p>
        <h1>Avatar Đại Việt</h1>
        <p>
          Màn hình này là ranh giới tích hợp cho file GLB từ Meshy AI. Canvas 3D không được tải ở
          trang chủ để bảo vệ hiệu năng trên thiết bị yếu.
        </p>
      </header>
      <section className="panel" aria-label="Xem trước avatar 3D">
        <AvatarPreview />
      </section>
    </main>
  );
}
