import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";

test("WhatsApp keeps voting private while locked, suppresses repeat joins, and closes on the last DM vote", async (t) => {
  const handlers = new Map<string, (event: any) => Promise<void>>();
  const sent: Array<{ jid: string; text: string }> = [];
  const settings: string[] = [];
  const socket = {
    ev: { on: (event: string, handler: (event: any) => Promise<void>) => handlers.set(event, handler) },
    sendMessage: async (jid: string, message: { text: string }) => { sent.push({ jid, text: message.text }); },
    groupSettingUpdate: async (_jid: string, setting: string) => { settings.push(setting); },
    groupMetadata: async () => ({ participants: [{ id: "1@s.whatsapp.net", admin: "admin" }] })
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
    assert.ok(sent.some((message) => message.jid === group && message.text === "VILLAGE WINS."));
    assert.ok(sent.some((message) => message.jid === group && message.text.includes(`${wolf} — Werewolf has been eliminated.`)));
    t.mock.timers.tick(1000);
    await send(ids[0], "!xeno status");
    assert.match(sent.at(-1)!.text, /Eliminated · 1/);
    assert.ok(sent.at(-1)!.text.includes(`${wolf} — Werewolf`));
  } finally {
    t.mock.timers.reset();
    hooks.deregister();
    delete (globalThis as any).__part6Socket;
    process.chdir(previousDirectory);
    rmSync(directory, { recursive: true, force: true });
  }
});
