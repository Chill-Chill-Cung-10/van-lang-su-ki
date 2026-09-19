import assert from "node:assert/strict";
import test from "node:test";
import { applyAssemblyPlacement, applyCorrectAnswer, applyWrongAnswer, emptyPuzzleSave, getTrayPieceIds, PUZZLE_SIZE } from "./kinh-duong-vuong-puzzle";

test("wrong answers do not place a piece and correct answers place it once", () => {
  const initial = emptyPuzzleSave("account-1");
  assert.equal(initial.unlocked.length, 0);
  const placed = applyCorrectAnswer(initial, 1);
  assert.equal(placed.unlocked.length, 1);
  assert.equal(applyCorrectAnswer(placed, 1), placed);
});

test("a wrong answer moves only the current question to the end of the queue", () => {
  const initial = emptyPuzzleSave("account-1");
  const next = applyWrongAnswer(initial);
  assert.equal(next.unlocked.length, 0);
  assert.deepEqual(next.questionQueue.slice(0, 2), ["piece_02", "piece_03"]);
  assert.equal(next.questionQueue.at(-1), "piece_01");
});

test("all 21 unlocked pieces must be assembled before completing", () => {
  let state = emptyPuzzleSave("account-1");
  for (let piece = 1; piece <= PUZZLE_SIZE; piece += 1) state = applyCorrectAnswer(state, piece);
  assert.equal(state.completed, false);
  for (let piece = 1; piece <= PUZZLE_SIZE; piece += 1) state = applyAssemblyPlacement(state, piece);
  assert.equal(state.completed, true);
  assert.equal(JSON.parse(JSON.stringify(state)).assembled.length, 21);
});

test("can unlock any piece in arbitrary order", () => {
  let state = emptyPuzzleSave("account-1");
  state = applyCorrectAnswer(state, 8);
  assert.deepEqual(state.unlocked, [8]);
  assert.equal(state.questionQueue.includes("piece_08"), false);
  assert.equal(state.questionQueue.length, 20);

  state = applyCorrectAnswer(state, 3);
  assert.deepEqual(state.unlocked, [8, 3]);
  assert.equal(state.questionQueue.includes("piece_03"), false);
  assert.equal(state.questionQueue.length, 19);
});

test("a wrong answer for an arbitrary piece moves that piece to the end of the queue", () => {
  const initial = emptyPuzzleSave("account-1");
  const next = applyWrongAnswer(initial, 8);
  assert.equal(next.unlocked.length, 0);
  assert.equal(next.questionQueue.at(-1), "piece_08");
  assert.equal(next.questionQueue[0], "piece_01");
});

test("the tray starts with the Kinh Dương Vương portrait piece", () => {
  const trayPieceIds = getTrayPieceIds(new Set());
  assert.equal(trayPieceIds.length, PUZZLE_SIZE);
  assert.equal(trayPieceIds[0], 3);
  assert.deepEqual(new Set(trayPieceIds), new Set(Array.from({ length: PUZZLE_SIZE }, (_, index) => index + 1)));
});
