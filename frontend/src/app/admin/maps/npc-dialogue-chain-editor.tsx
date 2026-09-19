"use client";

import type { MapNpcDialogueStep } from "@van-lang/map-contract";
import { useState } from "react";

export type NpcDialogueChainEditorProps = {
  chain: MapNpcDialogueStep[];
  onChange: (nextChain: MapNpcDialogueStep[]) => void;
  defaultSpeaker: string;
  readOnly?: boolean;
};

export function NpcDialogueChainEditor({
  chain,
  onChange,
  defaultSpeaker,
  readOnly = false,
}: NpcDialogueChainEditorProps) {
  const [showQuickImport, setShowQuickImport] = useState(false);
  const [quickImportText, setQuickImportText] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const steps = chain && chain.length > 0 ? chain : [{ text: "" }];

  const updateStep = (index: number, patch: Partial<MapNpcDialogueStep>) => {
    if (readOnly) return;
    const next = steps.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  };

  const addStep = () => {
    if (readOnly || steps.length >= 64) return;
    onChange([...steps, { text: "" }]);
  };

  const duplicateStep = (index: number) => {
    if (readOnly || steps.length >= 64) return;
    const target = steps[index];
    const next = [...steps];
    next.splice(index + 1, 0, { ...target });
    onChange(next);
  };

  const removeStep = (index: number) => {
    if (readOnly || steps.length <= 1) return;
    const next = steps.filter((_, i) => i !== index);
    onChange(next);
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    if (readOnly) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    const next = [...steps];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    onChange(next);
  };

  const handleQuickImport = () => {
    if (!quickImportText.trim() || readOnly) return;
    const lines = quickImportText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return;

    const importedSteps: MapNpcDialogueStep[] = lines.map((line) => {
      // Check if line starts with Speaker: Text
      const colonMatch = line.match(/^([^:：]{1,30})[:：]\s*(.+)$/);
      if (colonMatch) {
        return {
          speaker: colonMatch[1].trim(),
          text: colonMatch[2].trim().slice(0, 2000),
        };
      }
      return { text: line.slice(0, 2000) };
    });

    onChange(importedSteps.slice(0, 64));
    setQuickImportText("");
    setShowQuickImport(false);
  };

  return (
    <div className="npc-dialogue-chain-editor">
      <div className="dialogue-chain-header">
        <div className="dialogue-chain-title">
          <span>Chuỗi hội thoại</span>
          <span className="chain-step-count" title="Số lượt thoại">{steps.length} lượt</span>
        </div>
        <div className="dialogue-chain-top-actions">
          <button
            type="button"
            className={`chain-tool-btn ${showPreview ? "active" : ""}`}
            onClick={() => setShowPreview((prev) => !prev)}
            title="Xem trước chuỗi thoại dạng bong bóng"
          >
            {showPreview ? "Ẩn xem" : "Xem trước"}
          </button>
          <button
            type="button"
            className={`chain-tool-btn ${showQuickImport ? "active" : ""}`}
            onClick={() => setShowQuickImport((prev) => !prev)}
            title="Nhập nhanh từ kịch bản dán nhiều dòng"
          >
            {showQuickImport ? "Đóng nhập" : "Nhập nhanh"}
          </button>
        </div>
      </div>

      {showQuickImport ? (
        <div className="quick-import-panel">
          <label className="quick-import-label">
            <span className="quick-import-hint">
              Dán kịch bản (mỗi dòng là một câu, hỗ trợ &quot;Người nói: Lời thoại&quot;):
            </span>
            <textarea
              rows={4}
              value={quickImportText}
              onChange={(e) => setQuickImportText(e.target.value)}
              placeholder={"Ví dụ:\nSử quan: Chào tráng sĩ!\nNgười chơi: Ta đến tìm bí kíp.\nSử quan: Hãy cẩn trọng phía trước!"}
            />
          </label>
          <div className="quick-import-actions">
            <button
              type="button"
              className="quick-import-submit"
              onClick={handleQuickImport}
              disabled={!quickImportText.trim()}
            >
              Áp dụng
            </button>
            <button
              type="button"
              className="quick-import-cancel"
              onClick={() => {
                setShowQuickImport(false);
                setQuickImportText("");
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      ) : null}

      {showPreview ? (
        <div className="dialogue-preview-stream" aria-label="Xem trước chuỗi thoại">
          <p className="preview-stream-kicker">Mô phỏng luồng thoại:</p>
          {steps.map((step, idx) => {
            const speakerName = step.speaker?.trim() || defaultSpeaker || "NPC";
            const isPlayer = speakerName.toLowerCase().includes("chơi") || speakerName.toLowerCase().includes("player");
            return (
              <div key={idx} className={`preview-bubble-row ${isPlayer ? "is-player" : "is-npc"}`}>
                <div className="preview-bubble-meta">
                  <span className="preview-step-num">#{idx + 1}</span>
                  <strong className="preview-speaker-tag">{speakerName}</strong>
                </div>
                <div className="preview-bubble-content">
                  {step.text.trim() || <em className="preview-empty">(Chưa có nội dung)</em>}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="dialogue-step-list">
        {steps.map((step, index) => {
          const charCount = step.text.length;
          const isOver = charCount > 2000;
          const isWarning = charCount > 1800;
          const currentSpeaker = step.speaker ?? "";

          return (
            <div key={index} className="dialogue-step-card">
              <div className="dialogue-step-header">
                <div className="dialogue-step-badge">
                  <span>Câu {index + 1}</span>
                  <small>/{steps.length}</small>
                </div>
                {!readOnly && (
                  <div className="dialogue-step-actions" role="toolbar" aria-label={`Thao tác câu ${index + 1}`}>
                    <button
                      type="button"
                      className="step-btn"
                      disabled={index === 0}
                      onClick={() => moveStep(index, -1)}
                      title="Di chuyển lên"
                      aria-label={`Di chuyển câu ${index + 1} lên`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="step-btn"
                      disabled={index === steps.length - 1}
                      onClick={() => moveStep(index, 1)}
                      title="Di chuyển xuống"
                      aria-label={`Di chuyển câu ${index + 1} xuống`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="step-btn"
                      disabled={steps.length >= 64}
                      onClick={() => duplicateStep(index)}
                      title="Nhân bản câu này"
                      aria-label={`Nhân bản câu ${index + 1}`}
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      className="step-btn step-btn-delete"
                      disabled={steps.length <= 1}
                      onClick={() => removeStep(index)}
                      title="Xóa câu này"
                      aria-label={`Xóa câu ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              <div className="dialogue-speaker-field">
                <label className="dialogue-speaker-label">
                  <span>Người nói</span>
                  <input
                    type="text"
                    value={currentSpeaker}
                    onChange={(e) => updateStep(index, { speaker: e.target.value })}
                    placeholder={`Mặc định (${defaultSpeaker || "NPC"})`}
                    readOnly={readOnly}
                  />
                </label>
                {!readOnly && (
                  <div className="quick-speaker-chips" aria-label="Gán nhanh người nói">
                    <button
                      type="button"
                      className={`speaker-chip ${!currentSpeaker ? "chip-active" : ""}`}
                      onClick={() => updateStep(index, { speaker: "" })}
                      title="Dùng tên mặc định của NPC"
                    >
                      NPC
                    </button>
                    <button
                      type="button"
                      className={`speaker-chip ${currentSpeaker === "Người chơi" ? "chip-active" : ""}`}
                      onClick={() => updateStep(index, { speaker: "Người chơi" })}
                      title="Đặt người nói là Người chơi"
                    >
                      Người chơi
                    </button>
                  </div>
                )}
              </div>

              <div className="dialogue-text-field">
                <textarea
                  rows={3}
                  aria-label={index === 0 ? "Hội thoại" : `Nội dung câu thoại ${index + 1}`}
                  value={step.text}
                  onChange={(e) => updateStep(index, { text: e.target.value })}
                  placeholder={`Nhập lời thoại lượt ${index + 1}...`}
                  readOnly={readOnly}
                />
                <div className="dialogue-char-counter">
                  <span className={isOver ? "counter-error" : isWarning ? "counter-warn" : ""}>
                    {charCount}/2000
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <button
          type="button"
          className="add-dialogue-step-btn"
          onClick={addStep}
          disabled={steps.length >= 64}
        >
          + Thêm lượt thoại ({steps.length}/64)
        </button>
      )}
    </div>
  );
}
