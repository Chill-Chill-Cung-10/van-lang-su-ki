"use client";

import type { MapDocument } from "@van-lang/map-contract";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VanlangCinematicLoader } from "./vanlang-cinematic-loader";
import { VanlangDungeonScreen } from "./vanlang-dungeon-screen";
import type { DungeonDrawer } from "./vanlang-dungeon-screen";
import { loadRuntimeMap } from "../_lib/map-api-client";
import { DUNGEON_SPAWN, npcPositionFromDocument, projectToNavmesh } from "./vanlang-navmesh";
import { VanlangWorldMap } from "./vanlang-world-map";
import "./vanlang-game-shell.css";
import {
  battlePassTracks,
  codexEntries,
  cutsceneSteps,
  dungeonNpcs,
  dungeonQuests,
  mapDungeons,
  playerCharacters,
} from "./vanlang-mock-data";


type GameScreen = "story" | "map" | "dungeon";
type HudTab = "character" | "codex" | "leaderboard" | "battlepass";
type CodexEntry = (typeof codexEntries)[number];
type Quest = (typeof dungeonQuests)[number];
type Npc = (typeof dungeonNpcs)[number];

type DialogState =
  | { kind: "timekeeper" }
  | { kind: "quest"; questId: string }
  | { kind: "boss"; questId: string }
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
const MOVEMENT_STEP = 0.28;
const MOVEMENT_SPEED = 2.4;
const MOVEMENT_TICK_MS = 32;

const DEFAULT_STATE: ProgressState = {
  screen: "story",
  storyIndex: 0,
  mapGuideSeen: false,
  selectedMap: "vanlang",
  selectedCharacterId: playerCharacters[0].id,
  unlockedCodexIds: [],
  completedQuests: [],
  playerPos: DUNGEON_SPAWN,
  totalSouls: 0,
  battlePassXp: 0,
  soundEnabled: true,
  musicEnabled: true,
};


const textToPercent = (current: number, total: number) => Math.round((current / Math.max(total - 1, 1)) * 100);

const rewardDisplay = (value: number) => `${value} linh hồn`;
const addUnique = (arr: string[], value: string) => (arr.includes(value) ? arr : [...arr, value]);

export default function VanlangGameShell({
  accountId,
  initialScreen,
  onBackToMenu,
}: {
  accountId: string;
  initialScreen?: GameScreen;
  onBackToMenu: () => void;
}) {
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
      const restored = JSON.parse(raw) as Partial<ProgressState>;
      return {
        ...DEFAULT_STATE,
        ...restored,
        playerPos: projectToNavmesh(restored.playerPos ?? DUNGEON_SPAWN),
        ...(initialScreen ? { screen: initialScreen } : {}),
      };
    } catch {
      return initialState;
    }
  });

  const [storyCharIndex, setStoryCharIndex] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [hudTab, setHudTab] = useState<HudTab>("character");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<boolean | null>(null);
  const [isPlayerMoving, setIsPlayerMoving] = useState(false);
  const [playerFacing, setPlayerFacing] = useState(Math.PI);
  const [dungeonDrawer, setDungeonDrawer] = useState<DungeonDrawer>(null);
  const [rebirthComplete, setRebirthComplete] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem(`vanlang-rebirth-seen:${accountId}`) === "true",
  );
  const [mapRevealed, setMapRevealed] = useState(false);
  const [isVanLangLoading, setIsVanLangLoading] = useState(false);
  const [mapDocument, setMapDocument] = useState<MapDocument | null>(null);
  const [mapFallbackActive, setMapFallbackActive] = useState(false);
  const [mapLoadError, setMapLoadError] = useState("");
  const latestStateRef = useRef(state);

  const ambientTimer = useRef<number | null>(null);
  const movementTimer = useRef<number | null>(null);
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
  const storyText = currentStep ? currentStep.text.slice(0, storyCharIndex) : "";
  const isTypingDone = Boolean(currentStep && storyCharIndex >= currentStep.text.length);

  const persist = useCallback((next: ProgressState | ((current: ProgressState) => ProgressState)) => {
    setState((current) => {
      const nextState = typeof next === "function" ? next(current) : next;
      latestStateRef.current = nextState;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      }
      return nextState;
    });
  }, []);

  useEffect(() => {
    if (state.screen !== "dungeon" || !state.selectedMap) return;
    let cancelled = false;
    void loadRuntimeMap(state.selectedMap).then((loaded) => {
      if (cancelled) return;
      setMapLoadError("");
      setMapDocument(loaded.document);
      setMapFallbackActive(loaded.fallback);
      const projected = projectToNavmesh(latestStateRef.current.playerPos, loaded.document);
      if (projected.x !== latestStateRef.current.playerPos.x || projected.y !== latestStateRef.current.playerPos.y) persist((current) => ({ ...current, playerPos: projected }));
    }).catch((caught) => { if (!cancelled) setMapLoadError(caught instanceof Error ? caught.message : "Không thể tải map."); });
    return () => { cancelled = true; };
  }, [state.screen, state.selectedMap, persist]);

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

  const movementLocked = Boolean(dialog || dungeonDrawer || !rebirthComplete);
  const movePlayer = useCallback(
    (dx: number, dy: number, step = MOVEMENT_STEP, saveImmediately = true) => {
      if (movementLocked) return;
      const length = Math.hypot(dx, dy) || 1;
      const stepX = (-dy / length) * step;
      const stepY = (dx / length) * step;
      const previousState = latestStateRef.current;
      const nextState = {
        ...previousState,
        playerPos: projectToNavmesh({
          x: previousState.playerPos.x + stepX,
          y: previousState.playerPos.y + stepY,
        }, mapDocument ?? undefined, previousState.playerPos),
      };
      latestStateRef.current = nextState;
      setState(nextState);
      if (saveImmediately) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      setPlayerFacing(Math.atan2(stepX, stepY));
      setIsPlayerMoving(true);
      if (movementTimer.current != null) window.clearTimeout(movementTimer.current);
      movementTimer.current = window.setTimeout(() => setIsPlayerMoving(false), 170);
    },
    [mapDocument, movementLocked],
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
      const target = mapDocument ? npcPositionFromDocument(mapDocument, npc.id) : null;
      if (!target) return false;
      return Math.hypot(target.x - state.playerPos.x, target.y - state.playerPos.y) <= 1.35;
    };

    return {
      timekeeper: npcTimekeeper && near(npcTimekeeper) ? npcTimekeeper : null,
      guide: npcGuide && near(npcGuide) ? npcGuide : null,
      boss: npcBoss && near(npcBoss) ? npcBoss : null,
      mentor: dungeonNpcs.find((npc) => npc.role === "mentor" && near(npc)) ?? null,
    };
  }, [mapDocument, npcBoss, npcGuide, npcTimekeeper, state.playerPos.x, state.playerPos.y]);
  const nearbyNpcForPrompt = nearbyNpc.timekeeper ?? nearbyNpc.guide ?? nearbyNpc.mentor ?? nearbyNpc.boss;

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

  const enterVanLang = useCallback(() => {
    setIsVanLangLoading(true);
    playTone(900, 70);
  }, [playTone]);

  const completeVanLangLoading = useCallback(() => {
    persist((prev) => ({ ...prev, selectedMap: "vanlang", screen: "dungeon", playerPos: DUNGEON_SPAWN }));
    setDialog(null);
    setDungeonDrawer(null);
    setIsVanLangLoading(false);
  }, [persist]);

  const moveToMap = useCallback(() => {
    setDialog(null);
    setDungeonDrawer(null);
    setIsPlayerMoving(false);
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
    setDungeonDrawer(null);
    const spawn = mapDocument ? { x: mapDocument.navigation.spawn.x, y: mapDocument.navigation.spawn.z } : DUNGEON_SPAWN;
    persist((prev) => ({ ...prev, selectedMap: activeMap.id, playerPos: spawn }));
  }, [activeMap.id, mapDocument, persist]);

  const completeRebirth = useCallback(() => {
    window.localStorage.setItem(`vanlang-rebirth-seen:${accountId}`, "true");
    setRebirthComplete(true);
  }, [accountId]);

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
    const movementVectors: Record<string, [number, number]> = {
      w: [0, -1],
      a: [-1, 0],
      s: [0, 1],
      d: [1, 0],
    };
    const pressed = new Set<string>();
    let frame = 0;
    let lastTick = performance.now();

    const flushPosition = () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(latestStateRef.current));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (state.screen !== "dungeon") return;
      if (event.key === "Escape") {
        setDialog(null);
        setDungeonDrawer(null);
        return;
      }

      const key = event.key.toLowerCase();
      const movement = movementVectors[key];
      if (movement || event.code === "Space" || event.key === " ") event.preventDefault();
      if (movementLocked) return;
      if (movement) {
        if (!pressed.has(key)) movePlayer(...movement, MOVEMENT_STEP, false);
        pressed.add(key);
      } else if ((event.code === "Space" || event.key === " ") && !event.repeat) {
        interact();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (pressed.delete(event.key.toLowerCase())) flushPosition();
    };

    const clearPressed = () => {
      if (pressed.size > 0) flushPosition();
      pressed.clear();
    };

    const tick = (now: number) => {
      if (now - lastTick >= MOVEMENT_TICK_MS) {
        const dx = Number(pressed.has("d")) - Number(pressed.has("a"));
        const dy = Number(pressed.has("s")) - Number(pressed.has("w"));
        if (dx !== 0 || dy !== 0) {
          const elapsed = Math.min((now - lastTick) / 1000, 0.05);
          movePlayer(dx, dy, MOVEMENT_SPEED * elapsed, false);
        }
        lastTick = now;
      }
      frame = window.requestAnimationFrame(tick);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearPressed);
    frame = window.requestAnimationFrame(tick);
    return () => {
      clearPressed();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearPressed);
    };
  }, [interact, movementLocked, movePlayer, state.screen]);

  useEffect(() => () => {
    if (movementTimer.current != null) window.clearTimeout(movementTimer.current);
  }, []);

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

  if (isVanLangLoading) {
    return <VanlangCinematicLoader onReady={completeVanLangLoading} />;
  }

  if (state.screen === "map") {
    return (
      <VanlangWorldMap
        revealed={mapRevealed}
        onReveal={() => setMapRevealed(true)}
        onEnterVanLang={enterVanLang}
        onBack={onBackToMenu}
      />
    );
  }

  if (state.screen === "dungeon") {
    if (mapLoadError) return <main id="noi-dung-chinh" className="game-root"><section className="panel"><h1>Không thể mở map</h1><p role="alert">{mapLoadError}</p><button onClick={moveToMap}>Quay lại Bản đồ Ký Ức</button></section></main>;
    if (!mapDocument) return <main id="noi-dung-chinh" className="game-root"><p role="status">Đang tải dữ liệu map…</p></main>;
    return (
      <VanlangDungeonScreen
        mapDocument={mapDocument}
        mapFallbackActive={mapFallbackActive}
        mapName={activeMap.name}
        playerPos={state.playerPos}
        facing={playerFacing}
        isMoving={isPlayerMoving}
        character={selectedCharacter}
        nearbyNpc={nearbyNpcForPrompt ?? null}
        rebirthRequired={!rebirthComplete}
        rebirthText={npcTimekeeper?.dialogue ?? ""}
        dialog={dialog}
        drawer={dungeonDrawer}
        unlockedCodexIds={state.unlockedCodexIds}
        completedQuests={state.completedQuests}
        totalSouls={state.totalSouls}
        battlePassXp={state.battlePassXp}
        selectedAnswer={selectedAnswer}
        answerResult={answerResult}
        bossRequirementsMet={bossRequirementsMet}
        onMove={movePlayer}
        onInteract={interact}
        onCompleteRebirth={completeRebirth}
        onCloseDialog={() => setDialog(null)}
        onOpenDrawer={setDungeonDrawer}
        onReset={clearBoard}
        onExit={moveToMap}
        onCollectGuideCodex={collectGuideCodex}
        onAnswerBoss={answerBoss}
      />
    );
  }

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

      <section className="layout">
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


