import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StatsStore } from "../src/stats.ts";

test("persists player stats and Chronicle entries", () => {
  const directory = mkdtempSync(join(tmpdir(), "lordxeno-stats-"));
  const path = join(directory, "stats.json");
  const first = new StatsStore(path);
  first.record("player-1", "seer", true, false, true);
  first.addChronicle("A legend was recorded.");
  const second = new StatsStore(path);
  assert.equal(second.get("player-1").wins, 1);
  assert.equal(second.chronicle()[0], "A legend was recorded.");
  rmSync(directory, { recursive: true, force: true });
});