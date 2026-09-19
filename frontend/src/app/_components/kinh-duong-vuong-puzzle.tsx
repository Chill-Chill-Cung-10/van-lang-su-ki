"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  congHuyenSuCards,
  congHuyenSuQuestions,
  type CongHuyenSuQuestion,
} from "../_data/cong-huyen-su-21-manh";

export const PUZZLE_SIZE = 21;
type StonePiece = { id: number; x: number; y: number; width: number; height: number };
const PUZZLE_BYPASS_ENABLED = process.env.NEXT_PUBLIC_PUZZLE_BYPASS === "true";
const PUZZLE_ASSET_REVISION = "20260919";
const STONE_PIECES: StonePiece[] = [
  [23, 20, 240, 278], [291, 24, 149, 273], [418, 0, 177, 298], [573, 23, 145, 274], [744, 21, 240, 276],
  [18, 292, 256, 231], [278, 289, 229, 229], [520, 289, 217, 228], [736, 293, 251, 230], [3, 520, 260, 204],
  [260, 505, 236, 216], [513, 504, 230, 211], [747, 517, 257, 207], [19, 712, 223, 249], [243, 706, 282, 256],
  [517, 706, 245, 254], [764, 712, 225, 249], [0, 957, 253, 261], [249, 950, 252, 268], [505, 949, 250, 269], [750, 957, 258, 261],
].map(([x, y, width, height], index) => ({ id: index + 1, x, y, width, height }));

export type StonePuzzleSave = { version: 3; accountId: string; mapId: "map2"; unlocked: number[]; assembled: number[]; questionQueue: string[]; completed: boolean };
export const puzzleStorageKey = (accountId: string) => `vanlang:kinh-duong-vuong-stone:v3:${encodeURIComponent(accountId)}`;
export const emptyPuzzleSave = (accountId: string): StonePuzzleSave => ({ version: 3, accountId, mapId: "map2", unlocked: [], assembled: [], questionQueue: congHuyenSuQuestions.map((question) => question.piece_id), completed: false });

export function readPuzzleSave(accountId: string): StonePuzzleSave {
  if (typeof window === "undefined") return emptyPuzzleSave(accountId);
  try {
    const value = JSON.parse(localStorage.getItem(puzzleStorageKey(accountId)) ?? "null") as Partial<StonePuzzleSave> | null;
    if (!value || value.version !== 3 || value.accountId !== accountId || value.mapId !== "map2" || !Array.isArray(value.unlocked) || !Array.isArray(value.assembled) || !Array.isArray(value.questionQueue)) return emptyPuzzleSave(accountId);
    const valid = (pieces: unknown[]) => [...new Set(pieces.filter((piece): piece is number => typeof piece === "number" && Number.isInteger(piece) && piece >= 1 && piece <= PUZZLE_SIZE))];
    const unlocked = valid(value.unlocked);
    const assembled = valid(value.assembled).filter((piece) => unlocked.includes(piece));
    const unlockedQuestionIds = new Set(unlocked.map((piece) => congHuyenSuQuestions.find((q) => q.order === piece)?.piece_id ?? `piece_${String(piece).padStart(2, "0")}`));
    const validQuestionIds = new Set(congHuyenSuQuestions.map((question) => question.piece_id));
    const questionQueue = value.questionQueue.filter((id): id is string => typeof id === "string" && validQuestionIds.has(id) && !unlockedQuestionIds.has(id));
    return { version: 3, accountId, mapId: "map2", unlocked, assembled, questionQueue, completed: assembled.length === PUZZLE_SIZE };
  } catch { return emptyPuzzleSave(accountId); }
}

export function applyCorrectAnswer(save: StonePuzzleSave, piece: number): StonePuzzleSave {
  if (save.unlocked.includes(piece)) return save;
  const targetPieceId = congHuyenSuQuestions.find((item) => item.order === piece)?.piece_id ?? `piece_${String(piece).padStart(2, "0")}`;
  return { ...save, unlocked: [...save.unlocked, piece], questionQueue: save.questionQueue.filter((id) => id !== targetPieceId) };
}

export function applyWrongAnswer(save: StonePuzzleSave, piece?: number): StonePuzzleSave {
  const targetPieceId = piece != null
    ? (congHuyenSuQuestions.find((item) => item.order === piece)?.piece_id ?? `piece_${String(piece).padStart(2, "0")}`)
    : save.questionQueue[0];
  if (!targetPieceId || !save.questionQueue.includes(targetPieceId)) return save;
  const remaining = save.questionQueue.filter((id) => id !== targetPieceId);
  return { ...save, questionQueue: [...remaining, targetPieceId] };
}

export function applyAssemblyPlacement(save: StonePuzzleSave, piece: number): StonePuzzleSave {
  if (!save.unlocked.includes(piece) || save.assembled.includes(piece)) return save;
  const assembled = [...save.assembled, piece];
  return { ...save, assembled, completed: assembled.length === PUZZLE_SIZE };
}

const pieceSrc = (id: number) => `/kinh-duong-vuong/pieces/stone_piece_${String(id).padStart(2, "0")}.png`;

export function getTrayPieceIds(placedPieceIds: ReadonlySet<number>) {
  return STONE_PIECES
    .filter((piece) => !placedPieceIds.has(piece.id))
    .sort((a, b) => a.id - b.id)
    .map((piece) => piece.id);
}

class PuzzleSoundFx {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  playHover() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(560, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Ignore
    }
  }

  playSelect() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.075);
    } catch {
      // Ignore
    }
  }

  playCorrect() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        const startTime = ctx.currentTime + idx * 0.09;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.45);
      });
    } catch {
      // Ignore
    }
  }

  playWrong() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.28);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.33);
    } catch {
      // Ignore
    }
  }

  playCrumble() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        const start = ctx.currentTime + i * 0.08;
        osc.frequency.setValueAtTime(120 - i * 22, start);
        osc.frequency.exponentialRampToValueAtTime(35, start + 0.38);
        gain.gain.setValueAtTime(0.13, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      }
    } catch {
      // Ignore
    }
  }

  playVictory() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        const startTime = ctx.currentTime + idx * 0.1;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.14, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.7);
      });
    } catch {
      // Ignore
    }
  }
}

const sfx = new PuzzleSoundFx();

const ASSEMBLY_ROWS: number[][] = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9],
  [10, 11, 12, 13],
  [14, 15, 16, 17],
  [18, 19, 20, 21],
];

export function KinhDuongVuongPuzzle({
  accountId,
  open,
  unlockedCodexIds = [],
  onClose,
  onProgress,
}: {
  accountId: string;
  open: boolean;
  unlockedCodexIds?: string[];
  onClose: () => void;
  onProgress: (save: StonePuzzleSave) => void;
}) {
  const [save, setSave] = useState(() => readPuzzleSave(accountId));
  const [piece, setPiece] = useState<number | null>(null);
  const [question, setQuestion] = useState<CongHuyenSuQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedAssemblyPiece, setSelectedAssemblyPiece] = useState<number | null>(null);
  const [placedSlots, setPlacedSlots] = useState<Record<number, number>>(() => {
    const initialSave = readPuzzleSave(accountId);
    if (initialSave.completed) {
      const all: Record<number, number> = {};
      for (let i = 1; i <= PUZZLE_SIZE; i++) all[i] = i;
      return all;
    }
    return {};
  });
  const [isCrumbling, setIsCrumbling] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [collapseAlert, setCollapseAlert] = useState("");
  const [dragPieceId, setDragPieceId] = useState<number | null>(null);
  const [dragSourceSlot, setDragSourceSlot] = useState<number | null>(null);
  const [dragHoverSlot, setDragHoverSlot] = useState<number | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; correctOptionIndex: number; generalExplanation: string; feedback: string } | null>(null);
  const [error, setError] = useState("");
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});
  const [codexSearch, setCodexSearch] = useState("");
  const [codexFilter, setCodexFilter] = useState<"all" | "unsolved" | "completed">("all");
  const [isModalCodexOpen, setIsModalCodexOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pieces = useMemo(() => STONE_PIECES, []);

  const toggleCard = (id: string) => {
    setCollapsedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleAllCards = (collapse: boolean) => {
    const next: Record<string, boolean> = {};
    for (const card of congHuyenSuCards) {
      next[card.knowledge_id] = collapse;
    }
    setCollapsedCards(next);
  };

  const filteredCodexCards = useMemo(() => {
    return congHuyenSuCards.filter((card) => {
      if (codexSearch.trim()) {
        const q = codexSearch.toLowerCase().trim();
        const matchTitle = card.title.toLowerCase().includes(q);
        const matchContent = card.card_text.toLowerCase().includes(q);
        const matchSource = (card.source_type || "").toLowerCase().includes(q);
        const matchClaim = (card.claim_status || "").toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchSource && !matchClaim) {
          return false;
        }
      }

      const cardPieceOrders = card.questions.map((q) => q.order);
      const solvedCount = cardPieceOrders.filter((p) => save.unlocked.includes(p)).length;
      const isCompleted = solvedCount === cardPieceOrders.length;

      if (codexFilter === "unsolved") return !isCompleted;
      if (codexFilter === "completed") return isCompleted;
      return true;
    });
  }, [codexSearch, codexFilter, save.unlocked]);

  const codexStats = useMemo(() => {
    let completed = 0;
    for (const card of congHuyenSuCards) {
      const cardPieceOrders = card.questions.map((q) => q.order);
      const solved = cardPieceOrders.filter((p) => save.unlocked.includes(p)).length;
      if (solved === cardPieceOrders.length) completed++;
    }
    return {
      total: congHuyenSuCards.length,
      completed,
      unsolved: congHuyenSuCards.length - completed,
    };
  }, [save.unlocked]);

  const activeCodexCard = useMemo(() => {
    if (piece == null) return null;
    return congHuyenSuCards.find((c) => c.questions.some((q) => q.order === piece)) ?? null;
  }, [piece]);

  const persist = (next: StonePuzzleSave) => { localStorage.setItem(puzzleStorageKey(accountId), JSON.stringify(next)); setSave(next); onProgress(next); };
  const choosePiece = (pieceId?: number) => {
    const targetPieceId = pieceId != null
      ? (congHuyenSuQuestions.find((item) => item.order === pieceId)?.piece_id ?? `piece_${String(pieceId).padStart(2, "0")}`)
      : save.questionQueue[0];
    const nextQuestion = congHuyenSuQuestions.find((item) => item.piece_id === targetPieceId);
    if (!nextQuestion) return;
    setPiece(nextQuestion.order);
    setQuestion(nextQuestion);
    setSelectedOption(null);
    setResult(null);
    setIsModalCodexOpen(true);
  };
  const closeQuestionModal = () => {
    setQuestion(null);
    setPiece(null);
    setSelectedOption(null);
    setResult(null);
    setError("");
  };

  useEffect(() => {
    if (!question || piece == null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        closeQuestionModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [question, piece, isSubmitting]);

  const handlePutPieceIntoSlot = (pieceId: number, targetSlot: number, fromSlot: number | null) => {
    sfx.playSelect();
    setCollapseAlert("");
    setError("");
    setPlacedSlots((prev) => {
      const next = { ...prev };
      const existingInTarget = next[targetSlot];

      if (fromSlot != null && fromSlot !== targetSlot) {
        if (existingInTarget != null) {
          next[fromSlot] = existingInTarget;
        } else {
          delete next[fromSlot];
        }
      } else {
        for (const [s, p] of Object.entries(next)) {
          if (p === pieceId && Number(s) !== targetSlot) {
            delete next[Number(s)];
          }
        }
      }

      next[targetSlot] = pieceId;
      return next;
    });
    setSelectedAssemblyPiece(null);
  };

  const handleRemoveFromSlot = (slotId: number) => {
    sfx.playSelect();
    setPlacedSlots((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
    setSelectedAssemblyPiece(null);
  };

  const handlePointerDown = (e: React.PointerEvent, pieceId: number, fromSlot: number | null) => {
    if (e.button !== 0 || isCrumbling || isMerging) return;
    e.preventDefault();
    setDragPieceId(pieceId);
    setDragSourceSlot(fromSlot);
    setPointerPos({ x: e.clientX, y: e.clientY });
    setSelectedAssemblyPiece(pieceId);
  };

  // DRAG AND HOLD POINTER TRACKING
  useEffect(() => {
    if (dragPieceId == null) return;
    const handlePointerMove = (e: PointerEvent) => {
      setPointerPos({ x: e.clientX, y: e.clientY });
      const elem = document.elementFromPoint(e.clientX, e.clientY);
      const slotElem = elem?.closest<HTMLElement>("[data-slot-id]");
      if (slotElem) {
        const slotId = Number(slotElem.dataset.slotId);
        setDragHoverSlot(Number.isInteger(slotId) ? slotId : null);
      } else {
        setDragHoverSlot(null);
      }
    };
    const handlePointerUp = () => {
      if (dragHoverSlot != null && dragPieceId != null) {
        handlePutPieceIntoSlot(dragPieceId, dragHoverSlot, dragSourceSlot);
      } else if (dragSourceSlot != null) {
        handleRemoveFromSlot(dragSourceSlot);
      }
      setDragPieceId(null);
      setDragSourceSlot(null);
      setDragHoverSlot(null);
      setPointerPos(null);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragPieceId, dragSourceSlot, dragHoverSlot]);

  const handleSlotClick = (slotId: number) => {
    if (isCrumbling || isMerging) return;
    const currentPieceInSlot = placedSlots[slotId];

    if (selectedAssemblyPiece != null) {
      handlePutPieceIntoSlot(selectedAssemblyPiece, slotId, null);
    } else if (currentPieceInSlot != null) {
      handleRemoveFromSlot(slotId);
    }
  };

  const handleHtml5DragStart = (e: DragEvent<HTMLElement>, pieceId: number, fromSlot: number | null) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ pieceId, fromSlot }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleHtml5Drop = (e: DragEvent<HTMLElement>, targetSlot: number) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (data && typeof data.pieceId === "number") {
        handlePutPieceIntoSlot(data.pieceId, targetSlot, data.fromSlot ?? null);
      }
    } catch {
      // Ignore
    }
  };

  const handleCompleteSubmit = () => {
    if (isSubmitting || isCrumbling || isMerging) return;
    const placedCount = Object.keys(placedSlots).length;
    if (placedCount < PUZZLE_SIZE) {
      setError(`Bạn cần ghép đủ ${PUZZLE_SIZE} mảnh đá trước khi hoàn thành (Hiện tại: ${placedCount}/${PUZZLE_SIZE}).`);
      return;
    }

    const isAllCorrect = Array.from({ length: PUZZLE_SIZE }, (_, i) => i + 1)
      .every((slotId) => placedSlots[slotId] === slotId);

    if (!isAllCorrect) {
      sfx.playCrumble();
      setIsCrumbling(true);
      setCollapseAlert("Thứ tự các mảnh cổ thạch chưa chính xác! Phiến đá đã rung chuyển và sụp đổ hoàn toàn. Hãy quan sát kỹ hoa văn và thử lại từ đầu.");
      setError("");
      setTimeout(() => {
        setPlacedSlots({});
        setSelectedAssemblyPiece(null);
        setIsCrumbling(false);
      }, 1000);
    } else {
      sfx.playVictory();
      setIsMerging(true);
      setCollapseAlert("");
      setError("");
      setTimeout(() => {
        const nextSave: StonePuzzleSave = {
          ...save,
          assembled: Array.from({ length: PUZZLE_SIZE }, (_, i) => i + 1),
          completed: true,
        };
        persist(nextSave);
        setIsMerging(false);
        setShowVictoryModal(true);
      }, 1300);
    }
  };

  const handleResetAssembly = () => {
    sfx.playSelect();
    setPlacedSlots({});
    setSelectedAssemblyPiece(null);
    setCollapseAlert("");
    setError("");
  };

  const answer = async () => {
    if (!question || piece == null || selectedOption == null || result || isSubmitting || save.unlocked.includes(piece)) return;
    setIsSubmitting(true);
    setError("");
    try {
      const correctOptionIndex = ["A", "B", "C", "D"].indexOf(question.answer);
      const nextResult = { isCorrect: PUZZLE_BYPASS_ENABLED || selectedOption === correctOptionIndex, correctOptionIndex, generalExplanation: question.explanation, feedback: question.explanation };
      setResult(nextResult);
      if (nextResult.isCorrect) {
        sfx.playCorrect();
        persist(applyCorrectAnswer(save, piece));
      } else {
        sfx.playWrong();
        persist(applyWrongAnswer(save, piece));
        setIsModalCodexOpen(true);
      }
    } catch { setError("Không thể chấm đáp án. Hãy thử lại."); }
    finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;
  const allUnlocked = save.unlocked.length === PUZZLE_SIZE;
  const isAssemblyPhase = allUnlocked && !save.completed;

  const placedPieceIds = new Set(Object.values(placedSlots));
  const trayPieces = getTrayPieceIds(placedPieceIds).map((id) => pieces[id - 1]);
  const placedCount = Object.keys(placedSlots).length;

  return (
    <div className="stone-puzzle-layer" role="presentation">
      <section className="stone-puzzle" role="dialog" aria-modal="true" aria-labelledby="stone-puzzle-title">
        <button className="stone-puzzle-close" type="button" onClick={onClose} aria-label="Đóng thử thách">×</button>
        <header className="stone-puzzle-header">
          <h2 id="stone-puzzle-title">Phiến đá Kinh Dương Vương</h2>
        </header>

        <div className={`stone-puzzle-body${isAssemblyPhase ? " is-assembly-mode" : isDockCollapsed ? " is-dock-collapsed" : ""}`}>
          <div className="stone-puzzle-main">
            {!allUnlocked ? (
              <>
                <p className="stone-progress">Mở khóa {save.unlocked.length}/{PUZZLE_SIZE} mảnh</p>
                <p className="stone-instruction">Chọn một mảnh để trả lời câu hỏi và mở khóa mảnh đó.</p>
                <div className="stone-board" aria-label="Bộ sưu tập 21 mảnh đá">
                  {pieces.map(({ id }) => {
                    const isUnlocked = save.unlocked.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`stone-board-piece ${isUnlocked ? "is-unlocked" : "is-locked"}`}
                        disabled={isUnlocked}
                        onClick={() => {
                          sfx.playSelect();
                          choosePiece(id);
                        }}
                        onMouseEnter={() => {
                          if (!isUnlocked) sfx.playHover();
                        }}
                        aria-label={`Mảnh đá ${id}${isUnlocked ? " đã mở khóa" : " chưa mở khóa, nhấn để giải ấn"}`}
                      >
                        <div className="stone-piece-img-wrap">
                          <Image src={pieceSrc(id)} alt="" width={160} height={160} />
                          {!isUnlocked && <div className="stone-piece-shimmer" aria-hidden="true" />}
                        </div>
                        {!isUnlocked ? (
                          <>
                            <div className="stone-piece-corners" aria-hidden="true">
                              <span className="corner c-tl" />
                              <span className="corner c-tr" />
                              <span className="corner c-bl" />
                              <span className="corner c-br" />
                            </div>
                            <div className="stone-piece-overlay" aria-hidden="true">
                              <div className="stone-lock-badge">
                                <svg className="stone-lock-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <span>Mở khóa</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="stone-unlocked-tag" aria-hidden="true">
                            <span>✓</span>
                          </div>
                        )}
                        <span className="stone-piece-idx">#{id}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : save.completed ? (
              <div className="stone-complete">
                <Image src="/kinh-duong-vuong/stone_full_00.png" alt="Phiến đá Kinh Dương Vương hoàn chỉnh" width={1008} height={1232} />
                <p>Phiến đá Thủy Tổ Kinh Dương Vương đã được phục dựng hoàn chỉnh.</p>
              </div>
            ) : (
              <div className="stone-assembly-viewport">
                {/* CỘT TRÁI: BÀN GHÉP 21 Ô ĐỒNG NHẤT KÍCH THƯỚC */}
                <div className="stone-board-column">
                  <div className={`stone-assembly-board${isCrumbling ? " is-crumbling" : ""}${isMerging ? " is-merging" : ""}`} aria-label="Khuôn phục dựng phiến đá">
                    {ASSEMBLY_ROWS.map((rowSlots, rowIndex) => (
                      <div key={rowIndex} className="stone-board-row">
                        {rowSlots.map((slotId) => {
                          const pieceId = placedSlots[slotId];
                          const isFilled = pieceId != null;
                          const isDragOver = dragHoverSlot === slotId;
                          const isHoldingThis = dragPieceId === pieceId;
                          const tilt = (slotId % 2 === 0 ? -1 : 1) * (14 + (slotId * 5) % 24);
                          const rot = (slotId % 2 === 0 ? 1 : -1) * (35 + (slotId * 9) % 45);

                          return (
                            <button
                              key={slotId}
                              type="button"
                              data-slot-id={slotId}
                              className={`stone-slot${isFilled ? " is-filled" : ""}${isDragOver ? " is-drag-over" : ""}${isCrumbling && isFilled ? " is-tumble-falling" : ""}${isMerging && isFilled ? " is-merging-piece" : ""}`}
                              style={{
                                ["--fall-delay" as string]: `${(slotId % 6) * 40}ms`,
                                ["--fall-tilt" as string]: `${tilt}deg`,
                                ["--fall-rot" as string]: `${rot}deg`,
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragHoverSlot(slotId);
                              }}
                              onDragLeave={() => {
                                if (dragHoverSlot === slotId) setDragHoverSlot(null);
                              }}
                              onDrop={(e) => {
                                handleHtml5Drop(e, slotId);
                                setDragHoverSlot(null);
                              }}
                              onPointerDown={(e) => {
                                if (isFilled && !isCrumbling && !isMerging) {
                                  handlePointerDown(e, pieceId, slotId);
                                }
                              }}
                              onClick={() => handleSlotClick(slotId)}
                              disabled={isCrumbling || isMerging}
                              aria-label={`Ô số ${slotId}${isFilled ? `, chứa mảnh ${pieceId}` : " trống"}`}
                            >
                              {isFilled ? (
                                <>
                                  <Image
                                    src={pieceSrc(pieceId)}
                                    alt={`Mảnh đá ${pieceId}`}
                                    width={120}
                                    height={120}
                                    className="stone-slot-piece-img"
                                    style={{ opacity: isHoldingThis ? 0.35 : 1 }}
                                  />
                                  <span className="stone-slot-remove-badge" title="Bấm để tháo mảnh">✕</span>
                                </>
                              ) : (
                                <span className="stone-slot-num">{slotId}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}

                    {isMerging && (
                      <div className="stone-full-statue-overlay" aria-hidden="true">
                        <Image
                          src="/kinh-duong-vuong/stone_full_00.png"
                          alt="Phiến đá Kinh Dương Vương hoàn chỉnh"
                          width={1008}
                          height={1232}
                          priority
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* CỘT PHẢI: KHAY MẢNH ĐÁ, TIẾN ĐỘ & NÚT HOÀN THÀNH */}
                <aside className="stone-assembly-sidebar" aria-label="Bảng điều khiển phục dựng">
                  <div className="stone-assembly-header-info">
                    <div className="stone-assembly-status-row">
                      <span className="stone-assembly-badge">Phục Dựng Cổ Thạch</span>
                      <span className="stone-assembly-count">{placedCount} / {PUZZLE_SIZE}</span>
                    </div>
                    <div className="stone-assembly-progress-bar">
                      <div
                        className="stone-assembly-progress-fill"
                        style={{ width: `${(placedCount / PUZZLE_SIZE) * 100}%` }}
                      />
                    </div>
                    <p className="stone-assembly-hint">
                      Tự do đặt các mảnh đá vào các ô theo suy đoán (cho phép đặt sai và lệch vị trí). Sau khi ghép đủ 21 mảnh, hãy nhấn &quot;Hoàn Thành Thử Thách&quot; để kiểm tra!
                    </p>
                  </div>

                  <div className="stone-tray-container">
                    <span className="stone-tray-label">Khay Mảnh Đá ({trayPieces.length} mảnh)</span>
                    <div className="stone-tray-grid" aria-label="Các mảnh đá chưa ghép">
                      {trayPieces.map((item) => {
                        const isSelected = selectedAssemblyPiece === item.id;
                        const isHolding = dragPieceId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            draggable
                            onDragStart={(e) => handleHtml5DragStart(e, item.id, null)}
                            onPointerDown={(e) => handlePointerDown(e, item.id, null)}
                            onClick={() => {
                              setError("");
                              setCollapseAlert("");
                              setSelectedAssemblyPiece((prev) => (prev === item.id ? null : item.id));
                            }}
                            className={`stone-tray-item${isSelected ? " is-selected" : ""}${isHolding ? " is-holding" : ""}`}
                            aria-pressed={isSelected}
                            aria-label={`Chọn mảnh đá ${item.id} để ghép`}
                            disabled={isCrumbling || isMerging}
                          >
                            <Image src={pieceSrc(item.id)} alt="" width={80} height={80} />
                          </button>
                        );
                      })}
                      {trayPieces.length === 0 && (
                        <p className="stone-tray-empty-hint">Đã đặt đủ 21 mảnh lên bảng. Hãy nhấn Hoàn thành để khai ấn kiểm tra!</p>
                      )}
                    </div>
                  </div>

                  {collapseAlert ? (
                    <div role="alert" className="stone-collapse-alert">
                      {collapseAlert}
                    </div>
                  ) : null}

                  {error ? <p role="alert" className="stone-error">{error}</p> : null}

                  <div className="stone-assembly-actions">
                    <button
                      type="button"
                      className={`stone-complete-submit-btn${placedCount === PUZZLE_SIZE ? " is-pulsing" : ""}`}
                      disabled={placedCount < PUZZLE_SIZE || isCrumbling || isMerging}
                      onClick={handleCompleteSubmit}
                    >
                      {isMerging
                        ? "Đang Khải Hoàn Hợp Nhất..."
                        : isCrumbling
                        ? "Đang Sụp Đổ..."
                        : placedCount === PUZZLE_SIZE
                        ? "⚡ Hoàn Thành Thử Thách"
                        : `Ghép Đủ 21/21 Mảnh (${placedCount}/${PUZZLE_SIZE})`}
                    </button>

                    {placedCount > 0 && !isCrumbling && !isMerging && (
                      <button
                        type="button"
                        className="stone-reset-assembly-btn"
                        onClick={handleResetAssembly}
                      >
                        ↺ Xếp lại từ đầu
                      </button>
                    )}
                  </div>
                </aside>

                {/* DRAG GHOST PREVIEW */}
                {dragPieceId != null && pointerPos != null && (
                  <div
                    className="stone-drag-ghost"
                    style={{ left: pointerPos.x, top: pointerPos.y }}
                    aria-hidden="true"
                  >
                    <Image src={pieceSrc(dragPieceId)} alt="" width={74} height={74} />
                  </div>
                )}
              </div>
            )}
          </div>

          {!isAssemblyPhase && (
            <aside className={`stone-codex-dock${isDockCollapsed ? " is-collapsed" : ""}`} aria-label="Dock ngữ liệu bí kíp">
              {isDockCollapsed ? (
                <button
                  type="button"
                  className="stone-dock-expand-btn"
                  onClick={() => setIsDockCollapsed(false)}
                  aria-label="Mở rộng dock ngữ liệu bí kíp"
                  title="Mở rộng ngữ liệu bí kíp"
                >
                  <span className="stone-dock-btn-icon" aria-hidden="true">📜</span>
                  <span className="stone-dock-vertical-text">Ngữ liệu Bí kíp</span>
                  <span className="stone-dock-arrow" aria-hidden="true">◀</span>
                </button>
              ) : (
                <div className="stone-dock-inner">
                  <div className="stone-codex-header">
                    <div className="stone-codex-title-wrap">
                      <span className="stone-codex-icon" aria-hidden="true">📜</span>
                      <div>
                        <h3>Ngữ liệu Bí kíp</h3>
                        <p className="stone-codex-sub">
                          7 Cổ thư • {save.unlocked.length}/{PUZZLE_SIZE} mảnh giải ấn
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="stone-dock-collapse-btn"
                      onClick={() => setIsDockCollapsed(true)}
                      aria-label="Thu gọn dock ngữ liệu"
                      title="Thu gọn dock"
                    >
                      Thu gọn ▶
                    </button>
                  </div>

                  {/* TOOLBAR: SEARCH & FILTER */}
                  <div className="stone-codex-toolbar">
                    <div className="stone-codex-search-wrap">
                      <span className="stone-codex-search-icon" aria-hidden="true">🔍</span>
                      <input
                        type="search"
                        className="stone-codex-search-input"
                        placeholder="Tìm dữ kiện sử liệu..."
                        value={codexSearch}
                        onChange={(e) => setCodexSearch(e.target.value)}
                        aria-label="Tìm kiếm ngữ liệu bí kíp"
                      />
                      {codexSearch && (
                        <button
                          type="button"
                          className="stone-codex-search-clear"
                          onClick={() => setCodexSearch("")}
                          aria-label="Xóa tìm kiếm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="stone-codex-filter-row">
                      <div className="stone-codex-filter-pills" role="tablist" aria-label="Bộ lọc bí kíp">
                        <button
                          type="button"
                          className={`stone-codex-filter-pill${codexFilter === "all" ? " is-active" : ""}`}
                          onClick={() => setCodexFilter("all")}
                        >
                          Tất cả ({codexStats.total})
                        </button>
                        <button
                          type="button"
                          className={`stone-codex-filter-pill${codexFilter === "unsolved" ? " is-active" : ""}`}
                          onClick={() => setCodexFilter("unsolved")}
                        >
                          Chưa xong ({codexStats.unsolved})
                        </button>
                        <button
                          type="button"
                          className={`stone-codex-filter-pill${codexFilter === "completed" ? " is-active" : ""}`}
                          onClick={() => setCodexFilter("completed")}
                        >
                          Đã xong ({codexStats.completed})
                        </button>
                      </div>
                      <button
                        type="button"
                        className="stone-codex-all-toggle-btn"
                        onClick={() => {
                          const hasCollapsed = filteredCodexCards.some((c) => collapsedCards[c.knowledge_id]);
                          handleToggleAllCards(!hasCollapsed);
                        }}
                      >
                        {filteredCodexCards.some((c) => collapsedCards[c.knowledge_id]) ? "Mở tất cả" : "Thu tất cả"}
                      </button>
                    </div>
                  </div>

                  <div className="stone-codex-list">
                    {filteredCodexCards.length === 0 ? (
                      <p className="stone-codex-empty-hint">Không tìm thấy bí kíp phù hợp.</p>
                    ) : (
                      filteredCodexCards.map((card) => {
                        const isCardCollapsed = Boolean(collapsedCards[card.knowledge_id]);
                        const isReceived = unlockedCodexIds.includes(card.knowledge_id);
                        const cardPieceOrders = card.questions.map((q) => q.order);
                        const solvedPieceCount = cardPieceOrders.filter((p) => save.unlocked.includes(p)).length;
                        const isFullySolved = solvedPieceCount === cardPieceOrders.length;

                        return (
                          <article
                            key={card.knowledge_id}
                            className={`stone-codex-card${isFullySolved ? " is-completed" : ""}`}
                          >
                            <button
                              type="button"
                              className="stone-codex-card-toggle"
                              onClick={() => toggleCard(card.knowledge_id)}
                              aria-expanded={!isCardCollapsed}
                            >
                              <span className="stone-codex-card-title">
                                <span className="stone-codex-seq">BK {String(card.sequence).padStart(2, "0")}</span>
                                <span className="stone-codex-name">{card.title}</span>
                                {isReceived ? <span className="stone-codex-chip">Vừa nhận</span> : null}
                                <span className={`stone-codex-status-pill ${isFullySolved ? "is-complete" : "is-progress"}`}>
                                  {isFullySolved ? "✓ 3/3" : `${solvedPieceCount}/3`}
                                </span>
                              </span>
                              <span className="stone-codex-chevron" aria-hidden="true">
                                {isCardCollapsed ? "▾ Mở" : "▴ Thu"}
                              </span>
                            </button>
                            {!isCardCollapsed ? (
                              <div className="stone-codex-card-body">
                                {card.story_transition ? (
                                  <p className="stone-codex-transition">{String(card.story_transition)}</p>
                                ) : null}
                                <p className="stone-codex-content">{card.card_text}</p>
                                <div className="stone-codex-meta">
                                  {card.source_type ? (
                                    <span className="stone-codex-meta-tag">📚 {card.source_type}</span>
                                  ) : null}
                                  {card.claim_status ? (
                                    <span className="stone-codex-meta-tag">⚖️ {card.claim_status}</span>
                                  ) : null}
                                </div>

                                <section className="stone-codex-pieces-strip" aria-label={`Gợi ý cho ${card.title}`}>
                                  <span className="stone-codex-pieces-label">Gợi ý tiếp cận</span>
                                  <p>Đối chiếu ngữ liệu trên với các câu hỏi sau:</p>
                                  <ul>
                                    {card.questions.map((question) => <li key={question.piece_id}>{question.question}</li>)}
                                  </ul>
                                </section>
                              </div>
                            ) : null}
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </section>

      {/* GAMIFICATION VICTORY MODAL */}
      {showVictoryModal && (
        <div className="stone-gamification-overlay" role="presentation">
          <div className="stone-gamification-dialog" role="dialog" aria-modal="true">
            <div className="stone-gamification-crown">👑</div>
            <span className="stone-gamification-kicker">CỔ THẠCH HOÀN MỸ • LINH TỰ VĂN LANG</span>
            <h3>Phục Dựng Thành Công Linh Tượng Thủy Tổ!</h3>
            <div className="stone-gamification-badge">
              <span>★</span> ĐẠI THÀNH CÔNG • 21/21 CỔ THẠCH <span>★</span>
            </div>
            <p className="stone-gamification-desc">
              Linh khí quy tụ, 21 mảnh vỡ cổ thạch đã gắn kết hoàn mỹ tái hiện chân dung Thủy Tổ Kinh Dương Vương uy nghiêm hộ quốc. Ký ức thời đại Hồng Bàng đã được phục hồi hoàn chỉnh!
            </p>
            <div className="stone-gamification-statue-preview">
              <Image
                src="/kinh-duong-vuong/stone_full_00.png"
                alt="Linh tượng Kinh Dương Vương hoàn chỉnh"
                width={180}
                height={220}
              />
            </div>
            <button
              type="button"
              className="stone-gamification-close-btn"
              onClick={() => setShowVictoryModal(false)}
            >
              Chiêm Bái Toàn Tượng
            </button>
          </div>
        </div>
      )}

      {question && piece != null ? (
        <div
          className="stone-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              closeQuestionModal();
            }
          }}
        >
          <div
            className="stone-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stone-modal-piece-title"
          >
            <div className="stone-modal-ornament-corners" aria-hidden="true">
              <span className="modal-corner mc-tl" />
              <span className="modal-corner mc-tr" />
              <span className="modal-corner mc-bl" />
              <span className="modal-corner mc-br" />
            </div>

            <header className="stone-modal-header">
              <div className="stone-modal-title-group">
                <span className="stone-modal-kicker">CỔ THẠCH VĂN LANG • KHAI ẤN KÝ ỨC</span>
                <h3 id="stone-modal-piece-title">Phiến Đá Kinh Dương Vương — Mảnh #{piece}</h3>
              </div>
              <div className="stone-modal-header-actions">
                <span className="stone-modal-progress-badge">
                  Tiến độ: {save.unlocked.length}/{PUZZLE_SIZE} mảnh
                </span>
                <button
                  className="stone-modal-close-btn"
                  type="button"
                  onClick={closeQuestionModal}
                  aria-label="Đóng bảng thử thách"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="stone-modal-body">
              {/* Phần (1): Hình dạng mảnh được unlock */}
              <section className="stone-pedestal-panel" aria-label="Bệ ngắm linh thạch">
                <div className="pedestal-panel-header">
                  <span className="pedestal-header-label">BỆ LINH THẠCH</span>
                  <span className="pedestal-piece-id">Mảnh #{piece} / 21</span>
                </div>

                <div className={`relic-display-stage ${result?.isCorrect ? "is-unlocked" : result ? "is-wrong" : "is-sealed"}`}>
                  <div className="relic-aura" aria-hidden="true" />
                  <div className="relic-runic-ring" aria-hidden="true" />

                  <div className="relic-image-container">
                    <Image
                      src={pieceSrc(piece)}
                      alt={`Hình dáng mảnh đá số ${piece}`}
                      width={240}
                      height={240}
                      className="relic-image"
                      priority
                    />
                    {result?.isCorrect && <div className="relic-unlock-burst" aria-hidden="true" />}
                  </div>

                  <div className="relic-status-badge">
                    {result?.isCorrect ? (
                      <div className="status-pill is-success">
                        <span className="status-dot success" />
                        <span>Khai mở thành công!</span>
                      </div>
                    ) : result ? (
                      <div className="status-pill is-failed">
                        <span className="status-dot failed" />
                        <span>Phong ấn chưa giải</span>
                      </div>
                    ) : (
                      <div className="status-pill is-locked">
                        <span className="status-dot locked" />
                        <span>Đang phong ấn</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pedestal-footer-info">
                  <p className="pedestal-hint">
                    {result?.isCorrect
                      ? "Linh khí đã quy tụ hoàn chỉnh. Mảnh cổ thạch đã được khôi phục nguyên trạng."
                      : "Trả lời chính xác câu hỏi đối diện để hóa giải phong ấn và thu nạp mảnh cổ thạch."}
                  </p>
                </div>
              </section>

              {/* Phần (2): Câu hỏi và các đáp án */}
              <section className="stone-quiz-panel" aria-label="Câu hỏi và đáp án giải ấn">
                <div className="quiz-meta-bar">
                  <span className="quiz-tag topic">Cổng Huyền Sử</span>
                  <span className="quiz-tag difficulty">
                    {question.difficulty ? `Độ khó: ${question.difficulty}` : "Thử thách ký ức"}
                  </span>
                </div>

                {activeCodexCard && (
                  <div className={`stone-quiz-codex-accordion${isModalCodexOpen ? " is-open" : ""}`}>
                    <button
                      type="button"
                      className="stone-quiz-codex-toggle"
                      onClick={() => setIsModalCodexOpen((prev) => !prev)}
                      aria-expanded={isModalCodexOpen}
                    >
                      <span className="stone-quiz-codex-title">
                        <span className="stone-quiz-codex-icon" aria-hidden="true">📜</span>
                        <strong>Tra cứu Bí kíp: {activeCodexCard.title}</strong>
                        <span className="stone-quiz-codex-tag">Tư liệu đối chiếu</span>
                      </span>
                      <span className="stone-quiz-codex-chevron">
                        {isModalCodexOpen ? "▲ Thu gọn" : "▼ Xem bí kíp"}
                      </span>
                    </button>
                    {isModalCodexOpen && (
                      <div className="stone-quiz-codex-content">
                        <p className="stone-quiz-codex-text">{activeCodexCard.card_text}</p>
                        <div className="stone-quiz-codex-meta">
                          {activeCodexCard.source_type ? (
                            <span className="stone-quiz-codex-meta-item">📚 Nguồn: {activeCodexCard.source_type}</span>
                          ) : null}
                          {activeCodexCard.claim_status ? (
                            <span className="stone-quiz-codex-meta-item">⚖️ {activeCodexCard.claim_status}</span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="quiz-question-box">
                  <p className="quiz-question-text">{question.question}</p>
                </div>

                <div className="quiz-options-group" role="radiogroup" aria-label="Các phương án trả lời">
                  {Object.entries(question.options).map(([letter, option], index) => {
                    const isSelected = selectedOption === index;
                    let statusClass = "";
                    if (result) {
                      if (result.isCorrect && isSelected) {
                        statusClass = "is-correct";
                      } else if (!result.isCorrect && isSelected) {
                        statusClass = "is-wrong";
                      } else if (!result.isCorrect && result.correctOptionIndex === index) {
                        statusClass = "is-revealed";
                      }
                    }

                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`quiz-option-item ${isSelected ? "is-selected" : ""} ${statusClass}`}
                        disabled={Boolean(result) || isSubmitting}
                        onClick={() => {
                          sfx.playSelect();
                          setSelectedOption(index);
                        }}
                        onMouseEnter={() => {
                          if (!result) sfx.playHover();
                        }}
                      >
                        <span className="option-token">{letter}</span>
                        <span className="option-text">{option}</span>
                        <span className="option-indicator" aria-hidden="true">
                          {statusClass === "is-correct" && "✓"}
                          {statusClass === "is-wrong" && "✕"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {error ? <p role="alert" className="stone-error quiz-error-alert">{error}</p> : null}

                {/* Result & Actions Footer */}
                <div className="quiz-bottom-actions">
                  {!result ? (
                    <button
                      className="wuxia-primary quiz-submit-action"
                      type="button"
                      disabled={selectedOption == null || isSubmitting}
                      onClick={answer}
                    >
                      {isSubmitting ? "Đang giải ấn..." : "Khai Ấn Trả Lời"}
                    </button>
                  ) : result.isCorrect ? (
                    <div className="quiz-result-wrapper is-success">
                      <div className="quiz-result-banner is-correct">
                        <div className="result-banner-icon">✨</div>
                        <div className="result-banner-text">
                          <strong>Chính xác! Mảnh thạch đã được khai mở.</strong>
                          {result.generalExplanation && <p>{result.generalExplanation}</p>}
                          {result.feedback && !result.generalExplanation && <p>{result.feedback}</p>}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="wuxia-primary quiz-continue-action"
                        onClick={closeQuestionModal}
                      >
                        Thu Nạp Mảnh & Tiếp Tục
                      </button>
                    </div>
                  ) : (
                    <div className="quiz-result-wrapper is-failure">
                      <div className="quiz-result-banner is-wrong">
                        <div className="result-banner-icon">⚠️</div>
                        <div className="result-banner-text">
                          <strong>Chưa chính xác! Phong ấn vẫn còn kiên cố.</strong>
                          <p>{result.feedback || "Hãy xem lại dữ kiện lịch sử và thử lại."}</p>
                        </div>
                      </div>
                      <div className="quiz-failure-buttons">
                        <button
                          type="button"
                          className="wuxia-secondary quiz-retry-action"
                          onClick={() => {
                            setResult(null);
                            setSelectedOption(null);
                          }}
                        >
                          Thử Lại Mảnh Này
                        </button>
                        <button
                          type="button"
                          className="wuxia-primary quiz-exit-action"
                          onClick={closeQuestionModal}
                        >
                          Đổi Mảnh Khác
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
