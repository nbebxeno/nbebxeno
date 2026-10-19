import assert from "node:assert/strict";
import test from "node:test";
import { COMMAND_REGISTRY, helpText, resolveCommand } from "../src/commands.ts";

test("help is generated from every registered command", () => {
  const output = helpText();
  for (const command of COMMAND_REGISTRY) {
    assert.match(output, new RegExp(command.usage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(output, /\*SETUP\*/);
  assert.match(output, /\*VOTING\*/);
});

test("registry resolves aliases and parameterized commands", () => {
  assert.equal(resolveCommand("!xeno start")?.name, "start");
  assert.equal(resolveCommand("!xeno startgame")?.name, "start");
  assert.equal(resolveCommand("!xeno vote 3")?.name, "vote");
  assert.equal(resolveCommand("!xeno night 2")?.name, "night");
  assert.equal(resolveCommand("!xeno unknown"), undefined);
});

test("registered command names are unique", () => {
  const names = COMMAND_REGISTRY.map((command) => command.name);
  assert.equal(new Set(names).size, names.length);
});