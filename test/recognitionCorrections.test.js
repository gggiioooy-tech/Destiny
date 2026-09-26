import assert from "node:assert/strict";
import test from "node:test";
import { correctRecognitionHero, createCorrectionQueue, getHeroAlternatives } from "../src/lib/recognitionCorrections.js";

const result = () => ({ requestId: "one", heroes: ["루디", "하연", "연희"], details: [
  { name: "루디", score: 0.61, confident: false, sample: "crop", candidates: [{ name: "루디" }, { name: "하연" }, { name: "바네사" }, { name: "바네사" }, { name: "린" }] },
  { name: "하연", confident: true }, { name: "연희", confident: true },
] });

test("candidate buttons remove the current hero, duplicate aliases, and occupied slots", () => {
  assert.deepEqual(getHeroAlternatives(result().details, 0), ["바네사", "린"]);
});
test("correction immediately updates the team without inventing engine confidence", () => {
  const before = result();
  const after = correctRecognitionHero(before, 0, "바네사");
  assert.deepEqual(after.heroes, ["바네사", "하연", "연희"]);
  assert.equal(after.details[0].score, 0.61);
  assert.equal(after.details[0].corrected, true);
  assert.equal(before.details[0].name, "루디");
  const twice = correctRecognitionHero(after, 0, "린");
  assert.equal(twice.details[0].originalName, "루디");
  assert.equal(twice.details[0].sample, "crop");
});
test("same, empty, missing slot, and duplicate selections do not alter the team", () => {
  const before = result();
  for (const [slot, name] of [[0, "루디"], [0, ""], [4, "바네사"], [0, "하연"]]) assert.equal(correctRecognitionHero(before, slot, name), before);
});
test("rapid corrections save in order, a failed save does not block the next, and other cards proceed independently", async () => {
  const queue = createCorrectionQueue();
  const events = [];
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const first = queue("one", async () => { events.push("first"); await blocked; throw Error("offline"); }).catch(() => {});
  const second = queue("one", async () => events.push("latest"));
  await queue("two", async () => events.push("other"));
  assert.deepEqual(events, ["first", "other"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first", "other", "latest"]);
});
