// The API handlers on the file store in demo mode: a visitor question runs, is saved, and shows up in the lists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const dir = mkdtempSync(`${tmpdir()}/confidant-`);
Object.assign(process.env, { DATA_DIR: dir, MOCK: "1", KV_REST_API_URL: "", UPSTASH_REDIS_REST_URL: "" });
const api = await import("../src/api.mjs");
const kv = await import("../src/kv.mjs");
test.after(() => rmSync(dir, { recursive: true, force: true }));

test("rejects a question outside the menu", async () => {
  const [status] = await api.tryQuestion({ category: "crypto", subject: "NOPE" }, "1.2.3.4");
  assert.equal(status, 400);
  assert.equal((await api.tryQuestion({ category: "cve", subject: "not-a-cve" }, "1.2.3.4"))[0], 400);
});

test("a visitor question is graded, saved and listed", async () => {
  const [status, round] = await api.tryQuestion({ category: "weather", subject: "Lagos" }, "1.2.3.4");
  assert.equal(status, 200);
  assert.equal(round.source, "visitor");
  assert.equal(round.questions[0].entries.length, 3);

  const [, list] = await api.listRounds(5);
  assert.equal(list[0].id, round.id);
  const [okStatus, again] = await api.oneRound(round.id);
  assert.equal(okStatus, 200);
  assert.equal(again.questions[0].prompt, round.questions[0].prompt);
  assert.equal((await api.oneRound("zzzzzzzz"))[0], 404);

  const [, s] = await api.getSummary();
  assert.equal(s.rounds, 1);
  assert.equal(s.leaderboard.length, 3);
});

test("only one visitor question runs at a time", async () => {
  assert.equal(await kv.lock("busy", 60), true);
  const [status, body] = await api.tryQuestion({ category: "weather", subject: "Lagos" }, "1.2.3.4");
  assert.equal(status, 429);
  assert.match(body.error, /busy/);
  await kv.unlock("busy");
});
