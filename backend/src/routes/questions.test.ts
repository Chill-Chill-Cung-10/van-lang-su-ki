import assert from "node:assert/strict";
import test from "node:test";
import { gradeQuestion, selectStageQuestions } from "./questions.js";

test("M01 pool can supply twenty unique questions", () => {
  const questions = Array.from({ length: 30 }, (_, index) => ({ id: `c1-M01-${index + 1}`, difficultyLevel: ["recognize", "understand", "apply", "challenge"][index % 4] }));
  const pool = selectStageQuestions(questions, { recognize: 4, understand: 3, apply: 2, challenge: 1 }, 20);
  assert.equal(pool.length, 20);
  assert.equal(new Set(pool.map((question) => question.id)).size, 20);
});

test("answer grading only awards damage for the correct option", () => {
  assert.deepEqual(gradeQuestion(2, 1, 10), { isCorrect: false, damage: 0 });
  assert.deepEqual(gradeQuestion(2, 2, 10), { isCorrect: true, damage: 10 });
});
