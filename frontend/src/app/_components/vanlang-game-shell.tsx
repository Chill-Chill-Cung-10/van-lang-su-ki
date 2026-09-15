"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./vanlang-game-shell.css";
import {
  battlePassTracks,
  codexEntries,
  cutsceneSteps,
  dungeonNpcs,
  dungeonQuests,
  dungeonTips,
  mapDungeons,
  playerCharacters,
} from "./vanlang-mock-data";

const VanlangDungeonWorld = dynamic(
  () => import("./vanlang-dungeon-world").then((module) => module.VanlangDungeonWorld),
  {
    ssr: false,
    loading: () => <div className="dungeon-world dungeon-world-loading" role="status" aria-label="Đang dựng phó bản 3D" />,
  },
);
type GameScreen = "story" | "map" | "dungeon";
type HudTab = "character" | "codex" | "leaderboard" | "battlepass";
type CodexEntry = (typeof codexEntries)[number];
type Quest = (typeof dungeonQuests)[number];
type Npc = (typeof dungeonNpcs)[number];

type DialogState =
  | { kind: "timekeeper" }
  | { kind: "quest"; questId: string }
  | { kind: "boss"; questId: string }
  | { kind: "map"; mapId: string }
  | null;

type ProgressState = {
  screen: GameScreen;
  storyIndex: number;
  mapGuideSeen: boolean;
  selectedMap: string | null;
  selectedCharacterId: string;
  unlockedCodexIds: string[];
  completedQuests: string[];
  playerPos: { x: number; y: number };
  totalSouls: number;
  battlePassXp: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
};

const STORAGE_KEY = "vanlang-game-mock-v4";
const GRID_SIZE = 8;
const MAX_POS = GRID_SIZE - 1;
const START_X = 2;
const START_Y = 3;

const DEFAULT_STATE: ProgressState = {
  screen: "story",
  storyIndex: 0,
  mapGuideSeen: false,
  selectedMap: "vanlang",
  selectedCharacterId: playerCharacters[0].id,
  unlockedCodexIds: [],
  completedQuests: [],
  playerPos: { x: START_X, y: START_Y },
  totalSouls: 0,
  battlePassXp: 0,
  soundEnabled: true,
  musicEnabled: true,
};

const clamp = (value: number) => Math.max(0, Math.min(MAX_POS, value));

const textToPercent = (current: number, total: number) => Math.round((current / Math.max(total - 1, 1)) * 100);

const rewardDisplay = (value: number) => `${value} linh hồn`;
const addUnique = (arr: string[], value: string) => (arr.includes(value) ? arr : [...arr, value]);

export default function VanlangGameShell({ initialScreen }: { initialScreen?: GameScreen }) {
  const [state, setState] = useState<ProgressState>(() => {
    const initialState = initialScreen ? { ...DEFAULT_STATE, screen: initialScreen } : DEFAULT_STATE;
    if (typeof window === "undefined") {
      return initialState;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return initialState;
      }
      return { ...DEFAULT_STATE, ...JSON.parse(raw), ...(initialScreen ? { screen: initialScreen } : {}) };
    } catch {
      return initialState;
    }
  });

  const [storyCharIndex, setStoryCharIndex] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [hudTab, setHudTab] = useState<HudTab>("character");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<boolean | null>(null);
  const [playerMotion, setPlayerMotion] = useState(0);

  const ambientTimer = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const selectedCharacter = useMemo(
    () => playerCharacters.find((character) => character.id === state.selectedCharacterId) ?? playerCharacters[0],
    [state.selectedCharacterId],
  );
  const guideQuest = useMemo(() => dungeonQuests.find((quest) => quest.type === "codex"), []);
  const bossQuest = useMemo(() => dungeonQuests.find((quest) => quest.type === "boss"), []);
  const npcTimekeeper = useMemo(() => dungeonNpcs.find((npc) => npc.role === "timekeeper"), []);
  const npcGuide = useMemo(() => dungeonNpcs.find((npc) => npc.role === "guide"), []);
  const npcBoss = useMemo(() => dungeonNpcs.find((npc) => npc.role === "boss"), []);
  const activeMap = useMemo(() => mapDungeons.find((map) => map.id === state.selectedMap) ?? mapDungeons[0], [state.selectedMap]);
  const bossRequirementsMet = useMemo(() => {
    if (!bossQuest) return false;
    return bossQuest.requiredCodexIds.every((id) => state.unlockedCodexIds.includes(id));
  }, [bossQuest, state.unlockedCodexIds]);

  const unlockedCodex = useMemo<CodexEntry[]>(() => {
    const found: CodexEntry[] = [];

    for (const entry of codexEntries) {
      if (state.unlockedCodexIds.includes(entry.id)) {
        found.push(entry);
      }
    }

    return found;
  }, [state.unlockedCodexIds]);

  const isQuestCompleted = useCallback(
    (questId: string) => state.completedQuests.includes(questId),
    [state.completedQuests],
  );

  const currentStep = cutsceneSteps[state.storyIndex];
  const storyPercent = textToPercent(state.storyIndex, cutsceneSteps.length);
  const mapTip = dungeonTips[state.storyIndex % dungeonTips.length];
  const storyText = currentStep ? currentStep.text.slice(0, storyCharIndex) : "";
  const isTypingDone = Boolean(currentStep && storyCharIndex >= currentStep.text.length);

  const persist = useCallback((next: ProgressState | ((current: ProgressState) => ProgressState)) => {
    setState((current) => {
      const nextState = typeof next === "function" ? next(current) : next;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      }
      return nextState;
    });
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }

    return audioCtxRef.current;
  }, []);

  const playTone = useCallback(
    (frequency: number, duration = 130, type: OscillatorType = "triangle", volume = 0.05) => {
      if (!state.soundEnabled || typeof window === "undefined") return;
      const context = ensureAudioContext();
      if (!context) return;

      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.frequency.value = frequency;
      osc.type = type;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(context.destination);
      const now = context.currentTime;
      osc.start(now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
      osc.stop(now + duration / 1000 + 0.04);
    },
    [ensureAudioContext, state.soundEnabled],
  );

  const stopAmbient = useCallback(() => {
    if (ambientTimer.current != null) {
      window.clearInterval(ambientTimer.current);
      ambientTimer.current = null;
    }
  }, []);

  const startAmbient = useCallback(() => {
    if (!state.musicEnabled || !state.soundEnabled || typeof window === "undefined") return;
    if (ambientTimer.current != null) return;

    ambientTimer.current = window.setInterval(() => {
      playTone(88, 240, "sine", 0.02);
    }, 1900);
  }, [playTone, state.musicEnabled, state.soundEnabled]);

  useEffect(() => {
    if (state.musicEnabled && state.soundEnabled) {
      startAmbient();
    } else {
      stopAmbient();
    }

    return stopAmbient;
  }, [state.musicEnabled, state.soundEnabled, startAmbient, stopAmbient]);

  const movePlayer = useCallback(
    (dx: number, dy: number) => {
      persist((prev) => ({
        ...prev,
        playerPos: {
          x: clamp(prev.playerPos.x + dx),
          y: clamp(prev.playerPos.y + dy),
        },
      }));
      setPlayerMotion((current) => current + 1);
      playTone(380, 40, "square", 0.05);
    },
    [persist, playTone],
  );

  const completeQuest = useCallback(
    (quest: Quest) => {
      persist((prev) => {
        const nextMap = new Set(prev.unlockedCodexIds);
        for (const item of quest.rewardCodexIds) {
          nextMap.add(item);
        }
        const nextXp = prev.battlePassXp + quest.rewardBattlePassXp;


        return {
          ...prev,
          unlockedCodexIds: Array.from(nextMap),
          completedQuests: addUnique(prev.completedQuests, quest.id),
          totalSouls: prev.totalSouls + quest.rewardSouls,
          battlePassXp: nextXp,
          // keep level only as visual feedback
        };
      });
      playTone(900, 80, "triangle", 0.07);
    },
    [persist, playTone],
  );

  const completeBossQuest = useCallback(
    (quest: Quest) => {
      persist((prev) => {
        const nextMap = new Set(prev.unlockedCodexIds);
        for (const item of quest.rewardCodexIds) {
          nextMap.add(item);
        }

        const nextXp = prev.battlePassXp + quest.rewardBattlePassXp;

        return {
          ...prev,
          unlockedCodexIds: Array.from(nextMap),
          completedQuests: addUnique(prev.completedQuests, quest.id),
          totalSouls: prev.totalSouls + quest.rewardSouls,
          battlePassXp: nextXp,
        };
      });
      playTone(1040, 120, "triangle", 0.07);
    },
    [persist, playTone],
  );

  const nearbyNpc = useMemo(() => {
    const near = (npc: Npc) => {
      return Math.abs(npc.x - state.playerPos.x) <= 1 && Math.abs(npc.y - state.playerPos.y) <= 1;
    };

    return {
      timekeeper: npcTimekeeper && near(npcTimekeeper) ? npcTimekeeper : null,
      guide: npcGuide && near(npcGuide) ? npcGuide : null,
      boss: npcBoss && near(npcBoss) ? npcBoss : null,
      mentor: dungeonNpcs.find((npc) => npc.role === "mentor" && near(npc)) ?? null,
    };
  }, [npcBoss, npcGuide, npcTimekeeper, state.playerPos.x, state.playerPos.y]);

  const interact = useCallback(() => {
    if (state.screen !== "dungeon") return;

    if (nearbyNpc.timekeeper) {
      setDialog({ kind: "timekeeper" });
      playTone(710, 60);
      return;
    }

    if (nearbyNpc.guide && guideQuest) {
      setDialog({ kind: "quest", questId: guideQuest.id });
      setSelectedAnswer(null);
      setAnswerResult(null);
      playTone(730, 60);
      return;
    }

    if (nearbyNpc.mentor) {
      setDialog({ kind: "timekeeper" });
      return;
    }

    if (nearbyNpc.boss && bossQuest) {
      setDialog({ kind: "boss", questId: bossQuest.id });
      setSelectedAnswer(null);
      setAnswerResult(null);
      playTone(760, 60);
    }
  }, [bossQuest, guideQuest, nearbyNpc.boss, nearbyNpc.guide, nearbyNpc.timekeeper, nearbyNpc.mentor, playTone, state.screen]);

  const openMapChallenge = useCallback(
    (mapId: string, isUnlocked: boolean) => {
      if (!isUnlocked) return;
      setDialog({ kind: "map", mapId });
      playTone(680, 60);
    },
    [playTone],
  );

  const openTimekeeperGuide = useCallback(() => {
    if (state.mapGuideSeen) {
      return;
    }

    persist((prev) => ({ ...prev, mapGuideSeen: true }));
    setDialog(null);
    playTone(760, 70, "triangle", 0.06);
  }, [persist, playTone, state.mapGuideSeen]);

  const beginChallenge = useCallback(() => {
    if (!dialog || dialog.kind !== "map") return;

    persist((prev) => ({ ...prev, selectedMap: dialog.mapId, screen: "dungeon", playerPos: { x: START_X, y: 3 } }));
    setDialog(null);
    playTone(900, 70);
  }, [dialog, persist, playTone]);

  const moveToMap = useCallback(() => {
    persist((prev) => ({ ...prev, screen: "map" }));
  }, [persist]);

  const collectGuideCodex = useCallback(() => {
    if (!guideQuest) return;
    if (isQuestCompleted(guideQuest.id)) {
      setDialog(null);
      return;
    }

    completeQuest(guideQuest);
    setDialog(null);
  }, [completeQuest, guideQuest, isQuestCompleted]);

  const answerBoss = useCallback(
    (index: number) => {
      if (!bossQuest) return;
      setSelectedAnswer(index);

      const selectedText = bossQuest.options?.[index] ?? "";
      const passed = selectedText === bossQuest.correctOption;
      setAnswerResult(passed);

      if (!passed) {
        playTone(220, 120, "sawtooth", 0.04);
        return;
      }

      completeBossQuest(bossQuest);
      playTone(1060, 120, "triangle", 0.08);
    },
    [bossQuest, completeBossQuest, playTone],
  );

  const proceedToMap = useCallback(() => {
    setDialog(null);
    moveToMap();
  }, [moveToMap]);

  const clearBoard = useCallback(() => {
    persist((prev) => ({ ...prev, selectedMap: activeMap.id, playerPos: { x: START_X, y: START_Y } }));
  }, [activeMap.id, persist]);

  useEffect(() => {
    if (!currentStep) return;

    const chars = currentStep.text;
    let timer: number | null = null;

    const starter = window.setTimeout(() => {
      setStoryCharIndex(0);
      timer = window.setInterval(() => {
        setStoryCharIndex((prev) => {
          if (prev >= chars.length) {
            return prev;
          }

          const next = prev + 1;
          if (next >= chars.length && timer != null) {
            clearInterval(timer);
            timer = null;
          }
          return next;
        });
      }, 15);
    }, 0);

    return () => {
      window.clearTimeout(starter);
      if (timer != null) {
        clearInterval(timer);
      }
    };
  }, [currentStep]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDialog(null);
        return;
      }

      if (dialog || state.screen !== "dungeon") {
        return;
      }

      const movement: Record<string, [number, number]> = {
        w: [0, -1],
        a: [-1, 0],
        s: [0, 1],
        d: [1, 0],
      };

      const key = event.key.toLowerCase();
      if (key in movement) {
        event.preventDefault();
        movePlayer(...movement[key]);
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        interact();
      }
    };

    window.addEventListener("keydown", handle);
    return () => {
      window.removeEventListener("keydown", handle);
    };
  }, [dialog, state.screen, interact, movePlayer]);

  const nextStoryStep = useCallback(() => {
    if (!isTypingDone) return;

    if (state.storyIndex + 1 < cutsceneSteps.length) {
      persist((prev) => ({ ...prev, storyIndex: prev.storyIndex + 1 }));
      return;
    }

    persist((prev) => ({ ...prev, screen: "map" }));
  }, [isTypingDone, persist, state.storyIndex]);

  const previousStoryStep = useCallback(() => {
    if (state.storyIndex <= 0) return;

    persist((prev) => ({ ...prev, storyIndex: prev.storyIndex - 1 }));
  }, [persist, state.storyIndex]);
  return (
    <main id="noi-dung-chinh" className="game-root">
      <header className="topbar">
        <p className="topbar-title">Van Lang ARPG Mock — Chuyến Hành Trình Chuyển Sinh</p>
        <div className="topbar-controls">
          <button type="button" className="ghost-btn" onClick={() => setHudTab("character")}>
            Nhân vật: {selectedCharacter.name}
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={() =>
              persist((prev) => ({
                ...prev,
                soundEnabled: !prev.soundEnabled,
              }))
            }
          >
            SFX {state.soundEnabled ? "Bật" : "Tắt"}
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={() =>
              persist((prev) => ({
                ...prev,
                musicEnabled: !prev.musicEnabled,
              }))
            }
          >
            Ambient {state.musicEnabled ? "Bật" : "Tắt"}
          </button>
          <span className="chip">Onboarding {storyPercent}%</span>
        </div>
      </header>

      <section className={`layout ${state.screen === "dungeon" ? "dungeon-layout" : ""}`}>
        <aside className="left-panel">
          <div className="scene-box">
            <h3>Nhân vật</h3>
            <div className="char-grid">
              {playerCharacters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  className={`char-card ${character.id === selectedCharacter.id ? "active" : ""}`}
                  onMouseEnter={() => playTone(650, 20)}
                  onClick={() =>
                    persist((prev) => ({
                      ...prev,
                      selectedCharacterId: character.id,
                    }))
                  }
                >
                  <strong>{character.name}</strong>
                  <span>{character.role}</span>
                  <small>
                    HP {character.baseHp} · Mana {character.mana} · Tấn công {character.power}
                  </small>
                </button>
              ))}
            </div>
          </div>

          <div className="scene-box">
            <h3>Điều khiển</h3>
            <ul className="instructions">
              <li>W / A / S / D: di chuyển</li>
              <li>Space: tương tác NPC</li>
              <li>ESC: đóng popup</li>
            </ul>
          </div>

          <div className="scene-box">
            <h3>Battle Pass</h3>
            <p className="small">Mốc: {Math.min(10, Math.floor(state.battlePassXp / 100) + 1)}</p>
            <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.battlePassXp % 100}>
              <div className="xp-fill" style={{ width: `${state.battlePassXp % 100}%` }} />
            </div>
            <ul>
              {battlePassTracks.map((track) => (
                <li key={track.id}>
                  {track.title} · {track.requirement} · {rewardDisplay(track.reward)}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="center-panel">
          <div className="hero-layer">
            <Image
              className="hero-backdrop"
              src="/vanlang-battlefield.png"
              alt="Cảnh làng ven sông trong phó bản Văn Lang"
              fill
              priority
              sizes="(max-width: 1150px) 100vw, 52vw"
            />
            <div className="hero-scrim" aria-hidden="true" />
            <div className="character-shell">
              <p className="overline">Nhân vật đang chọn</p>
              <p>
                {selectedCharacter.name} · {selectedCharacter.element}
              </p>
              <p className="small">HP {selectedCharacter.baseHp} · Mana {selectedCharacter.mana}</p>
            </div>
          </div>

          {state.screen === "story" && (
            <section className="content-card">
              <p className="kicker">{currentStep.heading}</p>
              <h1>{currentStep.title}</h1>
              <p className="story-text">{storyText}</p>
              <p className="small">{isTypingDone ? "Nội dung sẵn sàng" : "Đang mô tả nội dung..."}</p>

              <div className="story-actions">
                <button
                  className="ghost-btn"
                  type="button"
                  disabled={state.storyIndex === 0}
                  onMouseEnter={() => playTone(520, 25)}
                  onClick={previousStoryStep}
                >
                  Quay lại
                </button>
                <button
                  className="primary-btn"
                  type="button"
                  onMouseEnter={() => playTone(760, 25)}
                  onClick={nextStoryStep}
                >
                  {state.storyIndex + 1 === cutsceneSteps.length ? "ĐÃ HIỂU!" : "Tiếp theo"}
                  <span aria-hidden>→</span>
                </button>
              </div>
            </section>
          )}

          {state.screen === "map" && (
            <section className="content-card">
              <h1>Bản đồ phó bản</h1>

              {!state.mapGuideSeen ? (
                <article className="npc-banner">
                  <h2>{npcTimekeeper?.name ?? "Huyền quan giữ cổng"}</h2>
                  <p>{npcTimekeeper?.dialogue}</p>
                  <button type="button" className="primary-btn" onClick={openTimekeeperGuide}>
                    Tôi đã nhận hướng dẫn, vào map
                  </button>
                </article>
              ) : (
                <>
                  <p className="small">Chỉ phó bản Văn Lang mở sẵn trong MVP. Nhấn vào để vào thử thách.</p>
                  <div className="map-grid">
                    {mapDungeons.map((dungeon) => (
                      <button
                        key={dungeon.id}
                        type="button"
                        className={`dungeon-card ${dungeon.isUnlocked ? "open" : ""}`}
                        disabled={!dungeon.isUnlocked}
                        onMouseEnter={() => playTone(dungeon.isUnlocked ? 720 : 220, 24)}
                        onClick={() => openMapChallenge(dungeon.id, dungeon.isUnlocked)}
                      >
                        <strong>{dungeon.name}</strong>
                        <p>{dungeon.description}</p>
                        <p className="small">Độ khó: {dungeon.difficulty}</p>
                        <p className="small">Trạng thái: {dungeon.isUnlocked ? "Mở" : "Khóa"}</p>
                        <p className="small">Chi tiết: {dungeon.lore}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {state.screen === "dungeon" && (
            <section className="content-card dungeon-content">
              <VanlangDungeonWorld
                playerPos={state.playerPos}
                selectedCharacterId={state.selectedCharacterId}
                motionKey={playerMotion}
              />
              <div className="dungeon-copy">
                <p className="kicker">Văn Lang · Mảnh ký ức đầu tiên</p>
                <h1>Phó bản: {activeMap?.name}</h1>
                <p>{mapTip}</p>
              </div>
              <div className="dungeon-status" aria-live="polite">
                <span>Bí kíp {state.unlockedCodexIds.length}/{codexEntries.length}</span>
                <span>Linh hồn {state.totalSouls}</span>
                <span>Nhiệm vụ {state.completedQuests.length}/{dungeonQuests.length}</span>
              </div>
              <div className="dungeon-actions">
                <button type="button" className="ghost-btn" onClick={clearBoard}>
                  Trở lại cổng
                </button>
                <button type="button" className="primary-btn" onClick={moveToMap}>
                  Rời phó bản
                </button>
              </div>
            </section>
          )}
        </section>

        <aside className="right-panel">
          <div className="hud-tabs">
            <button
              className={`tab ${hudTab === "character" ? "active" : ""}`}
              type="button"
              onClick={() => setHudTab("character")}
            >
              Nhân vật
            </button>
            <button
              className={`tab ${hudTab === "codex" ? "active" : ""}`}
              type="button"
              onClick={() => setHudTab("codex")}
            >
              Bí kíp
            </button>
            <button
              className={`tab ${hudTab === "leaderboard" ? "active" : ""}`}
              type="button"
              onClick={() => setHudTab("leaderboard")}
            >
              Bảng xếp hạng
            </button>
            <button
              className={`tab ${hudTab === "battlepass" ? "active" : ""}`}
              type="button"
              onClick={() => setHudTab("battlepass")}
            >
              Battle Pass
            </button>
          </div>

          <div className="hud-tab-content">
            {hudTab === "character" && (
              <div className="scene-box">
                <h3>Thông tin nhân vật</h3>
                <p>
                  {selectedCharacter.name} · {selectedCharacter.element}
                </p>
                <p className="small">HP: {selectedCharacter.baseHp}</p>
                <p className="small">Mana: {selectedCharacter.mana}</p>
                <p className="small">Sức mạnh: {selectedCharacter.power}</p>
                <p className="small">Tốc độ: {selectedCharacter.speed}</p>
                <p className="small">Kỹ năng:</p>
                <ul>
                  {selectedCharacter.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
                <p className="small">Đặc điểm:</p>
                <ul>
                  {selectedCharacter.traits.map((trait) => (
                    <li key={trait}>{trait}</li>
                  ))}
                </ul>
              </div>
            )}

            {hudTab === "codex" && (
              <div className="scene-box">
                <h3>Bí kíp đã thu thập</h3>
                {unlockedCodex.length === 0 ? <p className="small">Chưa nhận được bí kíp.</p> : null}
                <ul>
                  {codexEntries.map((entry) => {
                    const isUnlocked = state.unlockedCodexIds.includes(entry.id);
                    return (
                      <li key={entry.id} className={isUnlocked ? "" : "locked"}>
                        <strong>{entry.title}</strong>
                        <p className="small">{isUnlocked ? entry.content : "Chưa mở khóa"}</p>
                        <p className="small">Nguồn: {entry.source}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {hudTab === "leaderboard" && (
              <div className="scene-box">
                <h3>Bảng xếp hạng</h3>
                <ol>
                  <li>Bạch Thời — 3.820</li>
                  <li>Hoàng Sơn — 3.150</li>
                  <li>Bạn — {state.totalSouls}</li>
                </ol>
                <p className="small">Xếp hạng thay đổi theo tổng linh hồn tích lũy.</p>
              </div>
            )}

            {hudTab === "battlepass" && (
              <div className="scene-box">
                <h3>Battle Pass</h3>
                <p className="small">Mốc: {Math.min(10, Math.floor(state.battlePassXp / 100) + 1)}</p>
                <p className="small">XP: {state.battlePassXp}</p>
                <p className="small">Nhiệm vụ hoàn tất: {isQuestCompleted(guideQuest?.id ?? "") ? "1" : "0"}/{dungeonQuests.length}</p>
                <div className="progress-track">
                  <div className="xp-fill" style={{ width: `${state.battlePassXp % 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>

      {dialog?.kind === "map" ? (
        <div className="overlay">
          <article className="modal">
            <h2>Thử thách phó bản</h2>
            <p>Mở khóa đầu tiên là phó bản: {activeMap?.name ?? "Văn Lang"}.</p>
            <p>Bạn có muốn vào thử thách này không?</p>
            <div className="modal-actions">
              <button
                className="ghost-btn"
                type="button"
                onClick={() => setDialog(null)}
              >
                Hủy
              </button>
              <button
                className="primary-btn"
                type="button"
                onClick={beginChallenge}
              >
                Chấp nhận thử thách
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {dialog?.kind === "timekeeper" ? (
        <div className="overlay">
          <article className="modal">
            <h2>Người canh cổng thời gian</h2>
            <p>{npcTimekeeper?.dialogue ?? "Chúc may mắn."}</p>
            <p className="small">Nhớ kiểm tra tab Bí kíp để xem phần thưởng của mình.</p>
            <div className="modal-actions">
              <button className="primary-btn" type="button" onClick={() => setDialog(null)}>
                Đã hiểu
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {dialog?.kind === "quest" && guideQuest ? (
        <div className="overlay">
          <article className="modal">
            <h2>Nhiệm vụ: {guideQuest.title}</h2>
            <p>{guideQuest.description}</p>
            {isQuestCompleted(guideQuest.id) ? (
              <p>Đã hoàn thành nhiệm vụ này.</p>
            ) : (
              <>
                <p className="small">Phần thưởng: {guideQuest.rewardCodexIds.length} bí kíp và linh hồn.</p>
                <div className="modal-actions">
                  <button className="ghost-btn" type="button" onClick={() => setDialog(null)}>
                    Để sau
                  </button>
                  <button className="primary-btn" type="button" onClick={collectGuideCodex}>
                    Nhận bí kíp từ NPC
                  </button>
                </div>
              </>
            )}
          </article>
        </div>
      ) : null}

      {dialog?.kind === "boss" && bossQuest ? (
        <div className="overlay">
          <article className="modal wide">
            <h2>{bossQuest.title}</h2>
            <p>{bossQuest.description}</p>

            {!bossRequirementsMet ? (
              <p className="danger">
                Chưa đủ bí kíp để mở khóa boss. Hãy thu thập đủ dữ kiện trước.
              </p>
            ) : null}

            {bossRequirementsMet && !isQuestCompleted(bossQuest.id) ? (
              <>
                <p className="small">{bossQuest.question}</p>
                <div className="question">
                  <ul>
                    {bossQuest.options?.map((option, index) => (
                      <li key={`${option}-${index}`}>
                        <button
                          className="ghost-btn"
                          type="button"
                          onMouseEnter={() => playTone(500 + index * 30, 25)}
                          onClick={() => answerBoss(index)}
                        >
                          {index + 1}. {option}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}

            {selectedAnswer !== null && answerResult === false ? <p className="danger">Sai rồi. Kiểm tra lại bí kíp trong tab Codex.</p> : null}
            {answerResult === true ? <p className="success">Chính xác. Boss đã bị khuất phục.</p> : null}

            <div className="modal-actions">
              <button className="ghost-btn" type="button" onClick={() => setDialog(null)}>
                Đóng
              </button>
              {answerResult || isQuestCompleted(bossQuest.id) ? (
                <button className="primary-btn" type="button" onClick={proceedToMap}>
                  Quay về map
                </button>
              ) : null}
            </div>
          </article>
        </div>
      ) : null}
    </main>
  );
}








