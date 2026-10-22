import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import type { PlayerStats } from "./stats.ts";

let initialized: Promise<void> | undefined;
const xml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]!));
export function leaderboardName(player: PlayerStats, rank: number): string {
  const name = player.displayName?.trim();
  return name && !name.includes("@") && !/^\+?\d[\d\s-]{6,}$/.test(name) ? name : `Villager ${rank}`;
}
export function leaderboardSvg(players: PlayerStats[]): string {
  const top = players.slice(0, 10), height = 300 + Math.max(1, top.length) * 80;
  const rows = top.map((player, i) => {
    const y = 228 + i * 80;
    const name = [...leaderboardName(player, i + 1)];
    const label = xml(name.length > 25 ? name.slice(0, 24).join("") + "…" : name.join(""));
    return `<rect x="40" y="${y - 30}" width="920" height="68" rx="10" fill="${i < 3 ? "#24232b" : "#191d28"}"/><text x="65" y="${y + 12}" fill="#d6b77b" font-size="25">${String(i + 1).padStart(2, "0")}</text><text x="135" y="${y + 12}" font-size="26" fill="#f2eee4">${label}</text><text x="665" y="${y + 12}" text-anchor="middle" font-size="26" fill="#d6b77b">${player.wins}</text><text x="785" y="${y + 12}" text-anchor="middle" font-size="22" fill="#c2c4cd">${player.games ? Math.round(player.wins / player.games * 100) : 0}%</text><text x="905" y="${y + 12}" text-anchor="middle" font-size="22" fill="#c2c4cd">${player.games}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}"><rect width="1000" height="${height}" fill="#10141f"/><rect x="24" y="24" width="952" height="${height - 48}" rx="18" fill="none" stroke="#756344"/><g font-family="DejaVu Sans,Roboto,Noto Sans,sans-serif"><text x="55" y="70" font-size="17" letter-spacing="4" fill="#d6b77b">LORDXENO / BRIAR HOLLOW</text><text x="55" y="125" font-size="42" fill="#f2eee4">The Village Hall of Fame</text><path d="M55 152H945" stroke="#514932"/><g font-size="14" fill="#9299ab" letter-spacing="2"><text x="65" y="185">RANK</text><text x="135" y="185">VILLAGER</text><text x="640" y="185">WINS</text><text x="745" y="185">WIN RATE</text><text x="875" y="185">GAMES</text></g>${rows || '<text x="55" y="245" font-size="24" fill="#c2c4cd">No legends yet. Finish a game to claim your place.</text>'}<text x="55" y="${height - 50}" font-size="16" fill="#9299ab">Ranked by wins · survival breaks ties · top 10</text></g></svg>`;
}
async function fontBytes(): Promise<Uint8Array> {
  const candidates = [process.env.LORDXENO_FONT_PATH, "/system/fonts/Roboto-Regular.ttf", "/system/fonts/NotoSans-Regular.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"];
  for (const path of candidates) if (path) { try { return new Uint8Array(await readFile(path)); } catch { /* Try the next installed font. */ } }
  throw new Error("No readable font available; use the text leaderboard.");
}
export async function leaderboardPng(players: PlayerStats[]): Promise<Buffer> {
  if (!initialized) initialized = readFile(fileURLToPath(import.meta.resolve("@resvg/resvg-wasm/index_bg.wasm"))).then((bytes) => initWasm(bytes)).catch((error) => { initialized = undefined; throw error; });
  await initialized;
  const renderer = new Resvg(leaderboardSvg(players), { font: { fontBuffers: [await fontBytes()], defaultFontFamily: "DejaVu Sans", loadSystemFonts: false } });
  try { const rendered = renderer.render(); try { return Buffer.from(rendered.asPng()); } finally { rendered.free(); } } finally { renderer.free(); }
}
