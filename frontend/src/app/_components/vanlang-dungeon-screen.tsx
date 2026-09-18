"use client";

import type { MapDocument, MapObject } from "@van-lang/map-contract";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ReactNode } from "react";
import type { DnNpc, PlayerCharacter } from "./vanlang-mock-data";
import { codexEntries, dungeonNpcs, dungeonQuests } from "./vanlang-mock-data";
import "./vanlang-dungeon-screen.css";

const VanlangDungeonWorld = dynamic(
  () => import("./vanlang-dungeon-world").then((module) => module.VanlangDungeonWorld),
  {
    ssr: false,
    loading: () => <div className="dungeon-world dungeon-world-loading" role="status">Đang dựng đấu trường…</div>,
  },
);

export type DungeonDrawer = "quests" | "codex" | "rewards" | "exit" | null;
export type DungeonDialogState =
  | { kind: "timekeeper" }
  | { kind: "quest"; questId: string }
  | { kind: "boss"; questId: string }
  | { kind: "generic"; npcId: string }
  | null;

function MapSprites({ document, layer }: { document: MapDocument; layer: "underlay2d" | "overlay2d" }) {
  return document.objects.filter((object): object is Extract<MapObject, { kind: "sprite2d" }> => object.kind === "sprite2d" && object.enabled && object.renderLayer === layer)
    .sort((a, b) => a.renderOrder - b.renderOrder || a.id.localeCompare(b.id))
    .map((object) => {
      const transform = object.transform2d;
      const style = {
        left: `${transform.position.x * 100}%`, top: `${transform.position.y * 100}%`,
        width: `${transform.size.width * 100}%`, height: `${transform.size.height * 100}%`,
        transformOrigin: `${transform.anchor.x * 100}% ${transform.anchor.y * 100}%`,
        transform: `translate(${-transform.anchor.x * 100}%, ${-transform.anchor.y * 100}%) rotate(${transform.rotationDeg}deg) scale(${transform.scale.x}, ${transform.scale.y})`,
        zIndex: object.renderOrder,
      } satisfies CSSProperties;
      return <Image unoptimized width={1} height={1} className={`map-sprite ${layer}`} key={object.id} src={object.src} alt={object.alt} style={style} onError={(event) => { event.currentTarget.hidden = true; console.error("Map sprite asset failed", object.id); }} />;
    });
}

type DungeonScreenProps = {
  mapDocument: MapDocument;
  mapFallbackActive: boolean;
  mapName: string;
  playerPos: { x: number; y: number };
  facing: number;
  isMoving: boolean;
  character: PlayerCharacter;
  nearbyNpc: Pick<DnNpc, "id" | "name"> | null;
  rebirthRequired: boolean;
  rebirthText: string;
  dialog: DungeonDialogState;
  drawer: DungeonDrawer;
  unlockedCodexIds: string[];
  completedQuests: string[];
  totalSouls: number;
  battlePassXp: number;
  selectedAnswer: number | null;
  answerResult: boolean | null;
  bossRequirementsMet: boolean;
  onMove: (dx: number, dy: number) => void;
  onInteract: () => void;
  onCompleteRebirth: () => void;
  onCloseDialog: () => void;
  onOpenDrawer: (drawer: DungeonDrawer) => void;
  onReset: () => void;
  onExit: () => void;
  onCollectGuideCodex: () => void;
  onAnswerBoss: (index: number) => void;
};

function Icon({ name }: { name: "scroll" | "book" | "reward" | "gate" | "hand" }) {
  const paths = {
    scroll: "M7 4h11v13H8a3 3 0 0 0-3 3V7a3 3 0 0 1 3-3Zm1 13a3 3 0 0 0-3 3h13v-3M10 8h5M10 11h5",
    book: "M4 5.5A3.5 3.5 0 0 1 7.5 2H12v17H7.5A3.5 3.5 0 0 0 4 22V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H12v17h4.5A3.5 3.5 0 0 1 20 22V5.5Z",
    reward: "M12 8v14M5 12h14v10H5V12ZM4 8h16v4H4V8Zm8 0H8.5A2.5 2.5 0 1 1 11 5.5L12 8Zm0 0h3.5A2.5 2.5 0 1 0-2.5-2.5L12 8Z",
    gate: "M5 21V5l7-3 7 3v16M9 21V9h6v12M3 21h18",
    hand: "M8 11V7a1.5 1.5 0 0 1 3 0v3-5a1.5 1.5 0 0 1 3 0v5-3a1.5 1.5 0 0 1 3 0v4-2a1.5 1.5 0 0 1 3 0v5c0 4-2.5 7-7 7h-1c-3 0-5-1.5-7-4l-2-2a1.5 1.5 0 0 1 2-2l3 2",
  } as const;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function WuxiaDialogue({ speaker, children, actions }: { speaker: string; children: ReactNode; actions: ReactNode }) {
  return (
    <section className="wuxia-dialogue-card" role="dialog" aria-modal="true" aria-labelledby="dungeon-dialog-speaker">
      <div className="wuxia-speaker" id="dungeon-dialog-speaker">{speaker}</div>
      <div className="wuxia-dialogue-copy">{children}</div>
      <div className="wuxia-dialogue-actions">{actions}</div>
    </section>
  );
}

export function VanlangDungeonScreen(props: DungeonScreenProps) {
  const [rebirthChars, setRebirthChars] = useState(0);
  const [dialogChars, setDialogChars] = useState(0);
  const introButton = useRef<HTMLButtonElement>(null);
  const timekeeper = useMemo(() => dungeonNpcs.find((npc) => npc.role === "timekeeper"), []);
  const guide = useMemo(() => dungeonNpcs.find((npc) => npc.role === "guide"), []);
  const boss = useMemo(() => dungeonNpcs.find((npc) => npc.role === "boss"), []);
  const guideQuest = useMemo(() => dungeonQuests.find((quest) => quest.type === "codex"), []);
  const bossQuest = useMemo(() => dungeonQuests.find((quest) => quest.type === "boss"), []);
  const rebirthTypingDone = rebirthChars >= props.rebirthText.length;

  useEffect(() => {
    if (!props.rebirthRequired) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setInterval(() => {
      setRebirthChars((current) => {
        const next = reducedMotion ? props.rebirthText.length : current + 1;
        if (next >= props.rebirthText.length) window.clearInterval(timer);
        return Math.min(next, props.rebirthText.length);
      });
    }, reducedMotion ? 0 : 18);
    return () => window.clearInterval(timer);
  }, [props.rebirthRequired, props.rebirthText]);

  useEffect(() => {
    if (props.rebirthRequired) introButton.current?.focus();
  }, [props.rebirthRequired]);

  const closeDrawer = () => props.onOpenDrawer(null);
  const genericNpcId = props.dialog?.kind === "generic" ? props.dialog.npcId : null;
  const genericNpc = genericNpcId ? props.mapDocument.npcs.find((npc) => npc.id === genericNpcId) : null;
  const dialogNpc = props.dialog?.kind === "quest" ? guide : props.dialog?.kind === "boss" ? boss : props.dialog?.kind === "generic" ? genericNpc : timekeeper;
  const dialogText = dialogNpc?.dialogue ?? "";
  const dialogTypingDone = dialogChars >= dialogText.length;

  useEffect(() => {
    let timer: number | null = null;
    const starter = window.setTimeout(() => {
      if (!props.dialog) {
        setDialogChars(0);
        return;
      }

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setDialogChars(reducedMotion ? dialogText.length : 0);
      if (reducedMotion) return;

      timer = window.setInterval(() => {
        setDialogChars((current) => {
          const next = Math.min(current + 1, dialogText.length);
          if (next >= dialogText.length && timer != null) window.clearInterval(timer);
          return next;
        });
      }, 18);
    }, 0);

    return () => {
      window.clearTimeout(starter);
      if (timer != null) window.clearInterval(timer);
    };
  }, [dialogText, props.dialog]);

  return (
    <main id="noi-dung-chinh" className="rebirth-arena" aria-label={`Phó bản ${props.mapName}`}>
      <div className="rebirth-arena-stage" style={{ backgroundColor: props.mapDocument.background.color }}>
        <Image
          className="rebirth-arena-background"
          src={props.mapDocument.background.src}
          alt={props.mapDocument.background.alt}
          fill
          priority
          sizes="(min-aspect-ratio: 16/9) 177.78vh, 100vw"
        />
        <MapSprites document={props.mapDocument} layer="underlay2d" />
        <VanlangDungeonWorld mapDocument={props.mapDocument} playerPos={props.playerPos} facing={props.facing} isMoving={props.isMoving} />
        <MapSprites document={props.mapDocument} layer="overlay2d" />
      </div>
      <div className="rebirth-arena-vignette" aria-hidden="true" />
      {props.mapFallbackActive ? <p className="map-fallback-status" role="status">MAP_FALLBACK_ACTIVE · đang dùng dữ liệu Văn Lang bundled</p> : null}

      {!props.rebirthRequired ? (
        <section className="rebirth-hud" aria-label="Trạng thái nhân vật">
          <div className="rebirth-hud-copy">
            <strong>{props.character.name}</strong>
            <div className="rebirth-health" aria-label={`Sinh lực ${props.character.baseHp} trên ${props.character.baseHp}`}>
              <span style={{ width: "100%" }} />
              <b>{props.character.baseHp}/{props.character.baseHp}</b>
            </div>
          </div>
        </section>
      ) : null}

      {!props.rebirthRequired ? (
        <nav className="dungeon-quickbar" aria-label="Tiện ích phó bản">
          <button type="button" onClick={() => props.onOpenDrawer("quests")} aria-label="Mở nhiệm vụ"><Icon name="scroll" /><span>Nhiệm vụ</span></button>
          <button type="button" onClick={() => props.onOpenDrawer("codex")} aria-label="Mở bí kíp"><Icon name="book" /><span>Bí kíp</span></button>
          <button type="button" onClick={() => props.onOpenDrawer("rewards")} aria-label="Mở phần thưởng"><Icon name="reward" /><span>Thưởng</span></button>
          <button type="button" onClick={() => props.onOpenDrawer("exit")} aria-label="Rời phó bản"><Icon name="gate" /><span>Rời</span></button>
        </nav>
      ) : null}

      {!props.rebirthRequired && !props.dialog && !props.drawer && props.nearbyNpc ? (
        <button className="npc-interact-prompt" type="button" onClick={props.onInteract}>
          <kbd>Space</kbd><span>Trò chuyện với {props.nearbyNpc.name}</span>
        </button>
      ) : null}

      {!props.rebirthRequired ? (
        <div className="touch-controls" aria-label="Điều khiển cảm ứng">
          <div className="touch-dpad">
            <button type="button" onPointerDown={() => props.onMove(0, -1)} aria-label="Đi lên">↑</button>
            <button type="button" onPointerDown={() => props.onMove(-1, 0)} aria-label="Đi sang trái">←</button>
            <button type="button" onPointerDown={() => props.onMove(1, 0)} aria-label="Đi sang phải">→</button>
            <button type="button" onPointerDown={() => props.onMove(0, 1)} aria-label="Đi xuống">↓</button>
          </div>
          <button className="touch-interact" type="button" onClick={props.onInteract} disabled={!props.nearbyNpc} aria-label="Tương tác với NPC"><Icon name="hand" /><span>Tương tác</span></button>
        </div>
      ) : null}

      {props.rebirthRequired ? (
        <div className="dungeon-dialogue-layer">
          <WuxiaDialogue
            speaker={timekeeper?.name ?? "Huyền Quan Canh Thời"}
            actions={
              <button
                ref={introButton}
                type="button"
                className="wuxia-primary"
                onClick={() => rebirthTypingDone ? props.onCompleteRebirth() : setRebirthChars(props.rebirthText.length)}
              >
                {rebirthTypingDone ? "Bước vào ký ức" : "Hiện toàn bộ"}
              </button>
            }
          >
            <p aria-live="polite">{props.rebirthText.slice(0, rebirthChars)}{rebirthTypingDone ? "" : <span className="type-cursor" aria-hidden="true" />}</p>
          </WuxiaDialogue>
        </div>
      ) : null}

      {props.dialog ? (
        <div className="dungeon-dialogue-layer">
          <WuxiaDialogue
            speaker={dialogNpc?.name ?? "Người giữ ký ức"}
            actions={
              <>
                <button type="button" className="wuxia-secondary" onClick={props.onCloseDialog}>Đóng</button>
                {props.dialog.kind === "quest" && guideQuest && !props.completedQuests.includes(guideQuest.id) ? (
                  <button type="button" className="wuxia-primary" onClick={props.onCollectGuideCodex}>Nhận bí kíp</button>
                ) : null}
                {props.dialog.kind === "boss" && (props.answerResult === true || (bossQuest && props.completedQuests.includes(bossQuest.id))) ? (
                  <button type="button" className="wuxia-primary" onClick={props.onExit}>Trở về Bản đồ</button>
                ) : null}
              </>
            }
          >
            <p aria-live="polite">{dialogText.slice(0, dialogChars)}{dialogTypingDone ? "" : <span className="type-cursor" aria-hidden="true" />}</p>
            {dialogTypingDone && props.dialog.kind === "quest" && guideQuest ? (
              <p className="dialogue-result">{props.completedQuests.includes(guideQuest.id) ? "Bí kíp này đã được ghi vào ký ức." : `Phần thưởng: ${guideQuest.rewardSouls} linh hồn.`}</p>
            ) : null}
            {dialogTypingDone && props.dialog.kind === "boss" && bossQuest && !props.bossRequirementsMet ? (
              <p className="dialogue-warning">Hãy nhận Bí kíp Buổi đầu dựng nước trước khi thử thách.</p>
            ) : null}
            {dialogTypingDone && props.dialog.kind === "boss" && bossQuest && props.bossRequirementsMet && props.answerResult !== true && !props.completedQuests.includes(bossQuest.id) ? (
              <div className="boss-question">
                <p>{bossQuest.question}</p>
                {bossQuest.options?.map((option, index) => (
                  <button key={option} type="button" className={props.selectedAnswer === index ? "is-selected" : ""} onClick={() => props.onAnswerBoss(index)}>
                    {index + 1}. {option}
                  </button>
                ))}
              </div>
            ) : null}
            {dialogTypingDone && props.answerResult === false ? <p className="dialogue-warning">Chưa đúng. Hãy đối chiếu lại bí kíp.</p> : null}
            {dialogTypingDone && props.answerResult === true ? <p className="dialogue-result">Chính xác. Ký ức Hùng Vương đã được phục hồi.</p> : null}
          </WuxiaDialogue>
        </div>
      ) : null}

      {props.drawer ? (
        <div className="dungeon-drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeDrawer()}>
          <aside className="dungeon-drawer" role="dialog" aria-modal="true" aria-labelledby="dungeon-drawer-title">
            <button className="drawer-close" type="button" onClick={closeDrawer} aria-label="Đóng bảng">×</button>
            <p className="drawer-kicker">Ký lục Văn Lang</p>
            <h2 id="dungeon-drawer-title">
              {props.drawer === "quests" ? "Nhiệm vụ" : props.drawer === "codex" ? "Bí kíp" : props.drawer === "rewards" ? "Phần thưởng" : "Rời phó bản"}
            </h2>
            {props.drawer === "quests" ? (
              <div className="drawer-list">{dungeonQuests.map((quest) => <article key={quest.id}><strong>{quest.title}</strong><p>{quest.description}</p><span>{props.completedQuests.includes(quest.id) ? "Đã hoàn tất" : "Đang chờ"}</span></article>)}</div>
            ) : null}
            {props.drawer === "codex" ? (
              <div className="drawer-list">{codexEntries.map((entry) => <article key={entry.id} className={!props.unlockedCodexIds.includes(entry.id) ? "is-locked" : ""}><strong>{props.unlockedCodexIds.includes(entry.id) ? entry.title : "Ký ức chưa mở"}</strong>{props.unlockedCodexIds.includes(entry.id) ? <p>{entry.content}</p> : null}</article>)}</div>
            ) : null}
            {props.drawer === "rewards" ? <div className="reward-tally"><p><span>Linh hồn</span><strong>{props.totalSouls}</strong></p><p><span>Battle Pass XP</span><strong>{props.battlePassXp}</strong></p></div> : null}
            {props.drawer === "exit" ? <><p>Tiến trình bí kíp và thử thách đã nhận sẽ được giữ lại.</p><div className="drawer-actions"><button type="button" className="wuxia-secondary" onClick={props.onReset}>Trở lại cổng</button><button type="button" className="wuxia-primary" onClick={props.onExit}>Về Bản đồ Ký Ức</button></div></> : null}
          </aside>
        </div>
      ) : null}
    </main>
  );
}






