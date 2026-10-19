import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { GameEngine, ROLE_DATABASE } from "../src/engine.ts";

test("WhatsApp keeps voting private while locked, suppresses repeat joins, and closes on the last DM vote", async (t) => {
  const handlers = new Map<string, (event: any) => Promise<void>>();
  const sent: Array<{ jid: string; text: string }> = [];
  const settings: string[] = [];
  let metadata: any = { participants: [{ id: "1@s.whatsapp.net", admin: "admin" }] };
  const socket = {
    user: { id: "15550002222:3@s.whatsapp.net", lid: "555@lid" },
    ev: { on: (event: string, handler: (event: any) => Promise<void>) => handlers.set(event, handler) },
    sendMessage: async (jid: string, message: { text: string }) => { sent.push({ jid, text: message.text }); },
    groupSettingUpdate: async (_jid: string, setting: string) => { settings.push(setting); },
    groupMetadata: async () => metadata
  };
  (globalThis as any).__part6Socket = socket;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (["@whiskeysockets/baileys", "pino", "qrcode", "qrcode-terminal"].includes(specifier)) {
        return { url: `part6mock:${specifier}`, shortCircuit: true };
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (!url.startsWith("part6mock:")) return next(url, context);
      const source = url.endsWith("baileys")
        ? 'export default () => globalThis.__part6Socket; export const DisconnectReason = { loggedOut: 401 }; export async function useMultiFileAuthState() { return { state: {}, saveCreds() {} }; }'
        : 'export default () => ({}); export function toFile() {}';
      return { format: "module", source, shortCircuit: true };
    }
  });
  const previousDirectory = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), "lordxeno-whatsapp-"));
  process.chdir(directory);
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  t.mock.timers.tick(1000);
  const advancedIds = Array.from({ length: 9 }, (_, i) => `${i + 10}@s.whatsapp.net`);
  const advancedPlayers = advancedIds.map((id) => ({ id, displayName: id }));
  const advancedRoles = ["werewolf", "alpha-werewolf", "doctor", "seer", "hunter", "murderer", "villager", "villager", "villager"];
  const advancedState = GameEngine.create(advancedPlayers, { tieRule: "no-elimination", revealRoleOnDeath: true }).stateSnapshot();
  advancedState.roles = Object.fromEntries(advancedIds.map((id, i) => [id, advancedRoles[i]]));
  advancedState.factions = Object.fromEntries(advancedIds.map((id, i) => [id, ROLE_DATABASE[advancedRoles[i]].faction]));
  delete advancedState.runtime;
  const advanced = GameEngine.restore(advancedState, { tieRule: "no-elimination", revealRoleOnDeath: true });
  advanced.beginNight();
  mkdirSync(".data");
  writeFileSync(".data/lordxeno-access.json", JSON.stringify({ gameMasters: ["15550001111@s.whatsapp.net"] }));
  writeFileSync(".data/lordxeno-games.json", JSON.stringify([{ groupId: "advanced@g.us", hostId: advancedIds[0], players: advancedPlayers, aliases: [], engineState: advanced.stateSnapshot(), mode: "chaos", phaseDeadline: Date.now() + 1_000_000 }]));
  try {
    await import("../src/whatsapp.ts");
    await setImmediate();
    const receive = handlers.get("messages.upsert")!;
    assert.ok(receive);
    const group = "test@g.us";
    const ids = [1, 2, 3, 4, 5].map((id) => `${id}@s.whatsapp.net`);
    const send = async (id: string, text: string, dm = false) => {
      await receive({ messages: [{ key: { remoteJid: dm ? id : group, participant: dm ? undefined : id }, message: { conversation: text }, pushName: id }] });
      await setImmediate();
    };
    await send(ids[0], "!lobby");
    await send(ids[0], "!mode classic");
    for (const id of ids.slice(1)) await send(id, "!join");
    sent.length = 0;
    t.mock.timers.tick(1000);
    await send(ids[1], "!join");
    t.mock.timers.tick(1000);
    await send(ids[1], "!join");
    assert.equal(sent.filter((message) => message.text.includes("already in the lobby")).length, 1);
    assert.equal(sent.filter((message) => message.text.includes("XENOVERSE LOBBY")).length, 0);
    await send(ids[0], "!startgame");
    await send(ids[0], "!status");
    const status = sent.at(-1)!.text;
    assert.match(status, /Time left: 120s/);
    for (const id of ids) assert.ok(status.includes(id));
    const roleCards = sent.filter((message) => message.text.includes("SECRET ROLE"));
    assert.equal(roleCards.length, 5);
    const wolf = roleCards.find((message) => message.text.includes("*Werewolf*\n"))!.jid;
    const seer = roleCards.find((message) => message.text.includes("*Seer*\n"))!.jid;
    const doctor = roleCards.find((message) => message.text.includes("*Doctor*\n"))!.jid;
    t.mock.timers.tick(60_000);
    await setImmediate();
    assert.equal(settings.at(-1), "not_announcement", "discussion must last longer than 60 seconds");
    t.mock.timers.tick(60_000);
    for (let i = 0; i < 15; i++) await setImmediate();
    assert.equal(settings.at(-1), "announcement");
    const targetNumber = ids.findIndex((id) => id !== wolf) + 1;
    await send(wolf, `!night ${targetNumber}`, true);
    await send(seer, `!night ${targetNumber}`, true);
    await send(doctor, `!night ${targetNumber}`, true);
    for (let i = 0; i < 15; i++) await setImmediate();
    assert.equal(settings.at(-1), "not_announcement");
    t.mock.timers.tick(120_000);
    for (let i = 0; i < 15; i++) await setImmediate();
    assert.equal(settings.at(-1), "announcement");
    assert.equal(sent.filter((message) => message.jid !== group && message.text.includes("⚖️ *YOUR VOTE*\n")).length, 5);
    await send(ids[0], "!vote 2");
    assert.match(sent.at(-1)!.text, /Voting happens privately/);
    await send(ids[0], "!resolve");
    assert.match(sent.at(-1)!.text, /Every living player must vote/);
    const wolfNumber = ids.indexOf(wolf) + 1;
    await send(ids[0], `!vote ${wolfNumber}`, true);
    await send(ids[0], "!unvote");
    assert.match(sent.at(-1)!.text, /privately/);
    await send(ids[0], "!unvote", true);
    t.mock.timers.tick(1000);
    await send(ids[0], `!vote ${wolfNumber}`, true);
    for (const id of ids.slice(1)) await send(id, `!vote ${wolfNumber}`, true);
    for (let i = 0; i < 15; i++) await setImmediate();
    assert.ok(sent.some((message) => message.jid === group && message.text.includes("VILLAGE WINS!")));
    assert.ok(sent.some((message) => message.jid === group && message.text.includes(`${wolf} — Werewolf has been eliminated.`)));
    t.mock.timers.tick(1000);
    await send(ids[0], "!xeno status");
    assert.match(sent.at(-1)!.text, /Eliminated · 1/);
    assert.ok(sent.at(-1)!.text.includes(`${wolf} — Werewolf`));
    // An active saved game with multiple wolves and a Neutral killer exercises
    // the real private-action parser, LID/PN aliasing, and death-action timer.
    const dm = async (id: string, text: string, alt?: string) => {
      await receive({ messages: [{ key: { remoteJid: id, remoteJidAlt: alt }, message: { conversation: text }, pushName: id }] });
      for (let i = 0; i < 15; i++) await setImmediate();
    };
    await dm("999@lid", "!actions", advancedIds[0]);
    assert.ok(sent.some((message) => message.jid === "999@lid" && message.text.includes("!act attack")));
    await dm("999@lid", "!act attack 8");
    await dm(advancedIds[1], "!act convert 7");
    await dm(advancedIds[2], "!act protect 3");
    await dm(advancedIds[3], "!act see 1");
    await dm(advancedIds[5], "!act kill 5");
    assert.ok(sent.some((message) => message.jid === advancedIds[3] && message.text.includes("appears werewolves-aligned")));
    assert.ok(sent.some((message) => message.jid === advancedIds[6] && message.text.includes("converted you")));
    assert.ok(sent.some((message) => message.jid === advancedIds[4] && message.text.includes("!act shoot")));
    assert.equal(settings.at(-1), "announcement");
    let saved = JSON.parse(readFileSync(".data/lordxeno-games.json", "utf8")).find((game: any) => game.groupId === "advanced@g.us");
    assert.equal(saved.engineState.phase, "reaction");
    assert.ok(saved.phaseDeadline > Date.now());
    await handlers.get("connection.update")!({ connection: "open" });
    for (let i = 0; i < 15; i++) await setImmediate();
    await dm(advancedIds[4], "!act shoot 1");
    assert.equal(settings.at(-1), "not_announcement");
    saved = JSON.parse(readFileSync(".data/lordxeno-games.json", "utf8")).find((game: any) => game.groupId === "advanced@g.us");
    assert.equal(saved.engineState.phase, "discussion");
    assert.equal(saved.phaseDeadline - Date.now(), 120_000);
    assert.equal(saved.engineState.alive.includes(advancedIds[0]), false);
    await dm(advancedIds[6], "!myrole");
    assert.ok(sent.some((message) => message.jid === advancedIds[6] && message.text.includes(`${advancedIds[1]} — Alpha Werewolf`)));
    t.mock.timers.tick(60_000);
    await setImmediate();
    assert.equal(settings.at(-1), "not_announcement");
    t.mock.timers.tick(60_000);
    for (let i = 0; i < 15; i++) await setImmediate();
    assert.equal(settings.at(-1), "announcement");
    const control = async (key: any, text: string) => {
      t.mock.timers.tick(1000);
      await receive({ messages: [{ key, message: { conversation: text }, pushName: "Controller" }] });
      for (let i = 0; i < 15; i++) await setImmediate();
    };
    const gm = "15550001111@s.whatsapp.net";
    await control({ remoteJid: "15550009999@s.whatsapp.net" }, "!games");
    assert.match(sent.at(-1)!.text, /Only a permanent Game Master/);
    await control({ remoteJid: gm }, "!gm");
    assert.match(sent.at(-1)!.text, /access: yes/);
    metadata = { participants: [{ id: "777@lid", phoneNumber: gm, admin: null }] };
    await control({ remoteJid: "777@lid" }, "!gm");
    assert.match(sent.at(-1)!.text, /access: yes/, "LID-only GM messages must resolve through trusted metadata");
    await control({ remoteJid: gm }, "!games");
    const code = sent.at(-1)!.text.match(/!endgame ([a-f0-9]{8})/)![1];
    await control({ remoteJid: gm }, `!endgame ${code}`);
    assert.match(sent.at(-1)!.text, /Game ended/);
    saved = JSON.parse(readFileSync(".data/lordxeno-games.json", "utf8")).find((game: any) => game.groupId === "advanced@g.us");
    assert.equal(saved.engineState.status, "ended");
    assert.equal(settings.at(-1), "not_announcement");
    const afterStop = sent.length;
    t.mock.timers.tick(60_000); await setImmediate();
    assert.equal(sent.length, afterStop, "ending must cancel phase timers");

    // A real admin can use the LID in metadata and the PN in the message.
    await control({ remoteJid: group, participant: ids[0] }, "!lobby");
    metadata = { participants: [{ id: "987@lid", phoneNumber: ids[0], isAdmin: true }] };
    await control({ remoteJid: group, participant: "987@lid", participantAlt: ids[0] }, "!endgame");
    assert.match(sent.at(-1)!.text, /Game ended/);
    assert.equal(JSON.parse(readFileSync(".data/lordxeno-games.json", "utf8")).some((game: any) => game.groupId === group), false);

    // A permanent GM is neither an admin nor the lobby host, but can kick/end.
    metadata = { participants: [{ id: gm, admin: null }] };
    await control({ remoteJid: group, participant: ids[0] }, "!lobby");
    await control({ remoteJid: group, participant: ids[0] }, "!mode classic");
    await control({ remoteJid: group, participant: ids[1] }, "!join");
    await control({ remoteJid: group, participant: gm }, "!kick 2");
    assert.match(sent.at(-1)!.text, /removed from the lobby/);
    await control({ remoteJid: group, participant: ids[1] }, "!endgame");
    assert.match(sent.at(-1)!.text, /Only a group admin or permanent Game Master/);
    await control({ remoteJid: group, participant: gm }, "!endgame");
    assert.match(sent.at(-1)!.text, /Game ended/);

    // The linked account can send its own control command; ordinary own
    // messages remain ignored, so generated replies cannot join games.
    await control({ remoteJid: group, participant: ids[0] }, "!lobby");
    await control({ remoteJid: group, fromMe: true }, "!join");
    await control({ remoteJid: group, fromMe: true }, "!endgame");
    assert.match(sent.at(-1)!.text, /Game ended/);
  } finally {
    t.mock.timers.reset();
    hooks.deregister();
    delete (globalThis as any).__part6Socket;
    process.chdir(previousDirectory);
    rmSync(directory, { recursive: true, force: true });
  }
});
