import assert from "node:assert/strict";
import test from "node:test";
import { COMMAND_REGISTRY, helpText, resolveCommand } from "../src/commands.ts";

test("help is generated from every registered command", () => {
  const output = helpText("all");
  for (const command of COMMAND_REGISTRY) {
    assert.match(output, new RegExp(command.usage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(output, /\*LOBBY & SETUP\*/);
  assert.match(output, /\*VOTING\*/);
});

test("registry resolves aliases and parameterized commands", () => {
  assert.equal(resolveCommand("!xeno start")?.name, "start");
  assert.equal(resolveCommand("!xeno startgame")?.name, "start");
  assert.equal(resolveCommand("!xeno vote 3")?.name, "vote");
  assert.equal(resolveCommand("!xeno night 2")?.name, "night");
  assert.equal(resolveCommand("!brief")?.name, "brief");
  assert.equal(resolveCommand("!explain")?.name, "brief");
  assert.equal(resolveCommand("!Xeno explain")?.name, "brief");
  assert.equal(resolveCommand("!xeno unknown"), undefined);
});

test("registered command names are unique", () => {
  const names = COMMAND_REGISTRY.map((command) => command.name);
  assert.equal(new Set(names).size, names.length);
});

test("short commands accept case and whitespace while legacy commands still resolve", () => {
  for (const [short, name] of [["!join", "join"], ["!status", "status"], ["!vote 2", "vote"], ["!night 3", "night"], ["!start", "start"], ["!unvote", "unvote"], ["!mode chaos", "mode"]]) {
    assert.equal(resolveCommand(short)?.name, name);
    assert.equal(resolveCommand(short.replace("!", "!xeno "))?.name, name);
  }
  assert.equal(resolveCommand("  !XENO   VOTE   2 ")?.name, "vote");
  assert.equal(resolveCommand("!STATUS")?.name, "status");
  assert.equal(resolveCommand("!xeno")?.name, "help");
  for (const text of ["join", "status", "let's !vote 2", "!unknown", "!xenojoin"]) assert.equal(resolveCommand(text), undefined);
});

test("help supports compact overview and filtered full explanations", () => {
  assert.ok(helpText().length < helpText("all").length);
  assert.match(helpText("voting"), /Cast a private lynch vote/);
  assert.doesNotMatch(helpText("voting"), /!kick/);
  assert.match(helpText("invalid"), /!help all/);
  assert.equal(resolveCommand("!help voting")?.name, "help");
  assert.equal(resolveCommand("!details")?.name, "details");
});
