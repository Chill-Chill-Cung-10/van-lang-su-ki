"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Direction = "left" | "right" | "up" | "down";

export function GameShell() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy: (removeCanvas: boolean) => void } | null>(null);
  const moveRef = useRef<((direction: Direction) => void) | null>(null);
  const [status, setStatus] = useState("Đang tải bản đồ mẫu…");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const Phaser = await import("phaser");
      if (cancelled || !containerRef.current) return;

      class HistoryQuestScene extends Phaser.Scene {
        private boat?: Phaser.GameObjects.Container;
        private keys?: Record<string, Phaser.Input.Keyboard.Key>;

        constructor() { super("history-quest"); }

        create() {
          const { width, height } = this.scale;
          this.cameras.main.setBackgroundColor("#0f3550");

          const graphics = this.add.graphics();
          graphics.fillGradientStyle(0x224f68, 0x224f68, 0x39748a, 0x39748a, 1);
          graphics.fillRect(0, 0, width, height);
          graphics.fillStyle(0xd4ad62, 0.22);
          for (let y = 50; y < height; y += 55) graphics.fillRect(0, y, width, 2);

          for (let index = 0; index < 7; index += 1) {
            const x = 90 + index * 120;
            const stake = this.add.rectangle(x, height - 65 - (index % 2) * 35, 12, 90, 0x4b2f21);
            stake.setRotation(index % 2 ? 0.12 : -0.08);
          }

          const hull = this.add.triangle(0, 0, -34, -8, 34, -8, 0, 22, 0x9a592f);
          const mast = this.add.rectangle(0, -26, 4, 48, 0xe8d6a8);
          const sail = this.add.triangle(12, -40, 0, -24, 29, -24, 0, 0xe9c46a);
          this.boat = this.add.container(width * 0.22, height * 0.52, [hull, mast, sail]);

          this.add.text(20, 18, "Bạch Đằng năm 938", { fontFamily: "Arial", fontStyle: "bold", fontSize: "24px", color: "#fff3cf" });
          this.add.text(20, 50, "Điều khiển thuyền qua bãi cọc", { fontFamily: "Arial", fontSize: "15px", color: "#d7e3eb" });

          if (this.input.keyboard) {
            this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
          }

          moveRef.current = (direction) => this.moveBoat(direction, 24);
          setStatus("Bản đồ đã sẵn sàng. Hãy điều khiển chiến thuyền.");
        }

        private moveBoat(direction: Direction, step: number) {
          if (!this.boat) return;
          const vectors = { left: [-step, 0], right: [step, 0], up: [0, -step], down: [0, step] } as const;
          const [dx, dy] = vectors[direction];
          const nextX = Phaser.Math.Clamp(this.boat.x + dx, 45, this.scale.width - 45);
          const nextY = Phaser.Math.Clamp(this.boat.y + dy, 95, this.scale.height - 45);
          this.tweens.add({ targets: this.boat, x: nextX, y: nextY, duration: 120, ease: "Sine.Out" });
        }

        update() {
          if (!this.keys || !this.boat) return;
          const speed = 2.5;
          if (this.keys.LEFT.isDown || this.keys.A.isDown) this.boat.x -= speed;
          if (this.keys.RIGHT.isDown || this.keys.D.isDown) this.boat.x += speed;
          if (this.keys.UP.isDown || this.keys.W.isDown) this.boat.y -= speed;
          if (this.keys.DOWN.isDown || this.keys.S.isDown) this.boat.y += speed;
          this.boat.x = Phaser.Math.Clamp(this.boat.x, 45, this.scale.width - 45);
          this.boat.y = Phaser.Math.Clamp(this.boat.y, 95, this.scale.height - 45);
        }
      }

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: 960,
        height: 480,
        backgroundColor: "#0f3550",
        scene: HistoryQuestScene,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { antialias: true, pixelArt: false },
      });
      gameRef.current = game;
    }

    void boot();
    return () => {
      cancelled = true;
      moveRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const move = useCallback((direction: Direction) => moveRef.current?.(direction), []);

  return (
    <div className="game-frame">
      <div ref={containerRef} className="game-canvas" aria-label="Bản đồ gameplay Bạch Đằng mẫu" />
      <p className="sr-only" aria-live="polite">{status}</p>
      <div className="game-controls" aria-label="Điều khiển chiến thuyền">
        <button type="button" onClick={() => move("left")} aria-label="Đi sang trái">←</button>
        <button type="button" onClick={() => move("up")} aria-label="Đi lên">↑</button>
        <button type="button" onClick={() => move("down")} aria-label="Đi xuống">↓</button>
        <button type="button" onClick={() => move("right")} aria-label="Đi sang phải">→</button>
      </div>
    </div>
  );
}
