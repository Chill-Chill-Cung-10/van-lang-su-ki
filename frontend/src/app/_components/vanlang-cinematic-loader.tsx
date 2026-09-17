"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { vanLangCinematicCopy } from "./vanlang-cinematic-copy";
import "./vanlang-cinematic-loader.css";

const vanLangResources = [
  "/cinematic/van-lang-intro.webp",
  "/vanlang-rebirth-arena.png",
  "/models/vanlang-rebirth/arena.runtime.glb",
  "/models/vanlang-rebirth/hero.runtime.glb",
  "/ui/wuxia/character_hud_panel.png",
  "/ui/wuxia/health_frame_glow.png",
  "/ui/wuxia/dialogue_box_base.png",
  "/ui/wuxia/dialogue_box_overlay_fx.png",
  "/ui/wuxia/quest_panel.png",
  "/ui/wuxia/nameplate.png",
] as const;

const minimumScreenTime = 2200;

export function VanlangCinematicLoader({ onReady }: { onReady: () => void }) {
  const [loadedCount, setLoadedCount] = useState(0);
  const totalCount = vanLangResources.length + 1;
  const progress = Math.round((loadedCount / totalCount) * 100);
  const loadingLabel = useMemo(() => {
    if (progress >= 100) return "Cổng ký ức đã mở";
    if (progress >= 70) return "Đánh thức cảnh giới Văn Lang";
    if (progress >= 35) return "Dựng lại làng cổ ven sông";
    return "Kết nối những mảnh ký ức";
  }, [progress]);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = performance.now();
    let cancelled = false;
    let finishTimer: number | null = null;

    const markLoaded = () => {
      if (!cancelled) setLoadedCount((current) => current + 1);
    };

    const resourceTasks = vanLangResources.map(async (source) => {
      try {
        const response = await fetch(source, { cache: "force-cache", signal: controller.signal });
        if (!response.ok) throw new Error(`Không thể tải ${source}`);
        await response.arrayBuffer();
      } catch (error) {
        if (!controller.signal.aborted) console.warn(error);
      } finally {
        markLoaded();
      }
    });

    const worldTask = import("./vanlang-dungeon-world")
      .catch((error: unknown) => console.warn("Không thể tải trước cảnh 3D Văn Lang", error))
      .finally(markLoaded);

    void Promise.allSettled([...resourceTasks, worldTask]).then(() => {
      const remainingTime = Math.max(0, minimumScreenTime - (performance.now() - startedAt));
      finishTimer = window.setTimeout(() => {
        if (!cancelled) onReady();
      }, remainingTime);
    });

    return () => {
      cancelled = true;
      controller.abort();
      if (finishTimer != null) window.clearTimeout(finishTimer);
    };
  }, [onReady]);

  return (
    <main className="vanlang-cinematic" aria-busy={progress < 100} aria-label="Đang tải phó bản Văn Lang">
      <Image
        className="cinematic-scene"
        src="/cinematic/van-lang-intro.webp"
        alt="Làng cổ Văn Lang bên sông trong màn sương bình minh"
        fill
        priority
        unoptimized
        sizes="100vw"
      />
      <div className="cinematic-shade" aria-hidden="true" />
      <div className="cinematic-mist mist-near" aria-hidden="true" />
      <div className="cinematic-mist mist-far" aria-hidden="true" />

      <section className="cinematic-copy" aria-labelledby="cinematic-title">
        <div className="cinematic-chapter">
          <span aria-hidden="true" />
          <p>{vanLangCinematicCopy.chapterLabel}</p>
          <span aria-hidden="true" />
        </div>
        <h1 id="cinematic-title">{vanLangCinematicCopy.title}</h1>
        <div className="cinematic-divider" aria-hidden="true"><i /><b /><i /></div>
        <h2>{vanLangCinematicCopy.subtitle}</h2>
        <p className="cinematic-body">{vanLangCinematicCopy.body}</p>
      </section>

      <section className="cinematic-loading" role="status" aria-live="polite">
        <div className="cinematic-loading-copy">
          <span>{loadingLabel}</span>
          <strong>{progress}%</strong>
        </div>
        <div className="cinematic-progress" role="progressbar" aria-label="Tiến độ tải tài nguyên Văn Lang" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <small>Đang chuẩn bị cảnh giới, nhân vật và di vật Đông Sơn</small>
      </section>
    </main>
  );
}

