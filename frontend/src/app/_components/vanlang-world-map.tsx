"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import "./vanlang-world-map.css";

const dynasties = [
  {
    id: "van-lang",
    name: "Văn Lang — Hùng Vương",
    period: "Thời đại Hùng Vương / Văn Lang",
    description: "Cụm cư trú nhà sàn và sân nghi lễ trống đồng, nơi hành trình tìm lại ký ức khởi đầu.",
    image: "/world-map/01_van-lang-hung-vuong.webp",
    x: 16,
    y: 66,
    unlocked: true,
  },
  {
    id: "au-lac",
    name: "Âu Lạc — Cổ Loa",
    period: "Âu Lạc / An Dương Vương",
    description: "Thành xoáy nhiều lớp, hào nước và dấu tích của tư duy phòng thủ cổ đại.",
    image: "/world-map/02_au-lac-co-loa.webp",
    x: 29,
    y: 47,
    unlocked: false,
  },
  {
    id: "hoa-lu",
    name: "Hoa Lư — Đinh / Tiền Lê",
    period: "Nhà Đinh – Tiền Lê",
    description: "Kinh đô nép giữa núi đá hiểm trở, mở đầu thời kỳ phong kiến độc lập.",
    image: "/world-map/03_hoa-lu-dinh-tien-le.webp",
    x: 39,
    y: 70,
    unlocked: false,
  },
  {
    id: "thang-long",
    name: "Thăng Long — Nhà Lý",
    period: "Nhà Lý",
    description: "Cung điện bên hồ sen, biểu trưng cho trung tâm văn trị và buổi đầu thịnh trị Thăng Long.",
    image: "/world-map/04_thang-long-ly-trieu.webp",
    x: 49,
    y: 39,
    unlocked: false,
  },
  {
    id: "le-trieu",
    name: "Lê Triều — Văn Hiến",
    period: "Lê sơ / Hậu Lê",
    description: "Điện thờ và bia đá gợi tinh thần văn hiến, quy củ và nền học trị của triều Lê.",
    image: "/world-map/05_le-trieu-van-hien.webp",
    x: 61,
    y: 22,
    unlocked: false,
  },
  {
    id: "tay-son",
    name: "Tây Sơn — Doanh Trại",
    period: "Nhà Tây Sơn",
    description: "Pháo đài trên núi, trống trận và khí thế của một phong trào khởi nghĩa mạnh mẽ.",
    image: "/world-map/06_tay-son-war-camp.webp",
    x: 64,
    y: 66,
    unlocked: false,
  },
  {
    id: "dong-a",
    name: "Đông A — Nhà Trần",
    period: "Nhà Trần",
    description: "Thành lũy ven sông và bến thuyền, mang tinh thần quân sự sông nước thời Trần.",
    image: "/world-map/07_tran-dynasty-river-citadel.webp",
    x: 75,
    y: 42,
    unlocked: false,
  },
  {
    id: "hue-nguyen",
    name: "Đế Đô Huế — Nhà Nguyễn",
    period: "Nhà Nguyễn",
    description: "Hoàng thành và cổng đế đô đánh dấu chặng cuối của hành trình qua các triều đại.",
    image: "/world-map/08_hue-nguyen-imperial-citadel.webp",
    x: 84,
    y: 69,
    unlocked: false,
  },
] as const;

const corners = [
  ["top-left", "/world-map/corner-top-left.webp"],
  ["top-right", "/world-map/corner-top-right.webp"],
  ["bottom-left", "/world-map/corner-bottom-left.webp"],
  ["bottom-right", "/world-map/corner-bottom-right.webp"],
] as const;

export function VanlangWorldMap({
  revealed,
  onReveal,
  onEnterVanLang,
  onBack,
}: {
  revealed: boolean;
  onReveal: () => void;
  onEnterVanLang: () => void;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState<(typeof dynasties)[number]["id"]>("van-lang");
  const selected = dynasties.find((dynasty) => dynasty.id === selectedId) ?? dynasties[0];

  useEffect(() => {
    if (revealed) return;

    const timer = window.setTimeout(onReveal, 280);
    return () => window.clearTimeout(timer);
  }, [onReveal, revealed]);

  return (
    <main id="noi-dung-chinh" className={`world-map-screen ${revealed ? "is-revealed" : ""}`}>
      <div className="world-map-canvas">
        <Image className="world-map-art" src="/world-map/map.webp" alt="Bản đồ hành trình các thời kỳ lịch sử Việt Nam" fill priority sizes="100vw" />
        <div className="world-map-vignette" aria-hidden="true" />

        <button className="map-back-button" type="button" onClick={onBack} aria-label="Quay lại màn hình chính">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7M8 12h11" />
          </svg>
          <span>
            <small>Quay lại</small>
            Màn hình chính
          </span>
        </button>

        {corners.map(([position, source]) => (
          <Image key={position} className={`map-corner ${position}`} src={source} alt="" width={1254} height={1254} aria-hidden="true" />
        ))}

        <header className="world-map-heading">
          <p>Dòng chảy sử Việt</p>
          <h1>Bản đồ Ký Ức</h1>
        </header>

        <div className="dynasty-layers" aria-label="Các vùng lịch sử trên bản đồ">
          {dynasties.map((dynasty, index) => (
            <button
              key={dynasty.id}
              type="button"
              className={`dynasty-node ${dynasty.unlocked ? "unlocked" : "locked"} ${selectedId === dynasty.id ? "selected" : ""}`}
              style={{ left: `${dynasty.x}%`, top: `${dynasty.y}%`, "--layer-delay": `${220 + index * 85}ms` } as CSSProperties}
              aria-pressed={selectedId === dynasty.id}
              aria-label={`${dynasty.name}${dynasty.unlocked ? ", đã mở" : ", chưa mở"}`}
              aria-describedby={dynasty.unlocked ? undefined : `dynasty-tooltip-${dynasty.id}`}
              onClick={() => setSelectedId(dynasty.id)}
            >
              <Image src={dynasty.image} alt="" width={240} height={240} sizes="(max-width: 760px) 100px, 12vw" />
              <span className="dynasty-name">{dynasty.name}</span>
              {!dynasty.unlocked ? (
                <>
                  <span className="dynasty-lock" aria-hidden="true">
                    <i className="dynasty-chain chain-left" />
                    <i className="dynasty-chain chain-right" />
                    <svg viewBox="0 0 32 36">
                      <path d="M9 15V10a7 7 0 0 1 14 0v5" />
                      <rect x="5" y="14" width="22" height="18" rx="3" />
                      <path d="M16 21v5" />
                    </svg>
                  </span>
                  <span className="dynasty-tooltip" id={`dynasty-tooltip-${dynasty.id}`} role="tooltip">
                    <small>Coming soon</small>
                    <strong>Ký ức đang được phục dựng</strong>
                  </span>
                </>
              ) : null}
            </button>
          ))}
        </div>

        <section className="map-lore" aria-live="polite">
          <div>
            <p>{selected.period}</p>
            <h2>{selected.name}</h2>
            <span>{selected.description}</span>
          </div>
          {selected.unlocked ? (
            <button type="button" onClick={onEnterVanLang}>Bước vào Văn Lang</button>
          ) : (
            <strong>Vùng ký ức chưa khai mở</strong>
          )}
        </section>

        <div className="cloud-reveal" aria-hidden="true">
          <span className="cloud-band cloud-one" aria-hidden="true" />
          <span className="cloud-band cloud-two" aria-hidden="true" />
          <span className="cloud-band cloud-three" aria-hidden="true" />
          <span className="cloud-band cloud-four" aria-hidden="true" />
        </div>
      </div>
    </main>
  );
}
