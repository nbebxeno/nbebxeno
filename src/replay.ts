import type { ReplayData } from "./engine.ts";

export function replayCard(replay: ReplayData, page = 1): string {
  const lines = replay.entries.map((entry) => `D${entry.day} / N${entry.night} · ${entry.text.replace(/\s+/g, " ").slice(0, 260)}`);
  const pages: string[][] = [[]];
  for (const line of lines) {
    let current = pages[pages.length - 1];
    if (current.join("\n").length + line.length > 2900) { current = []; pages.push(current); }
    current.push(line);
  }
  if (!Number.isInteger(page) || page < 1 || page > pages.length) return `Choose a replay page from 1 to ${pages.length}: !replay <page>.`;
  return ["*LORDXENO / THE VILLAGE CHRONICLE*", "────────────────", `Replay · ${page}/${pages.length}${replay.partial ? " · partial history" : ""}`, "",
    ...pages[page - 1], ...(!lines.length ? ["This older game has no recorded timeline."] : []), "",
    page < pages.length ? `!replay ${page + 1} · Continue` : "The chronicle closes. The village will deny everything."
  ].join("\n");
}
export function replayHighlights(replay: ReplayData): string {
  const highlights = replay.entries.filter((entry) => entry.kind === "death" || (entry.kind === "event" && /protection prevented|has joined|converted you|returned to life|saved by|fired a final shot/.test(entry.text))).slice(-5);
  return ["*LORDXENO / THE AFTERMATH*", "────────────────", ...highlights.map((entry) => `• ${entry.text.replace(/^\[(.*?)'s DM\] /, "$1: ").slice(0, 200)}`),
    ...(!highlights.length ? ["A suspiciously quiet chapter. Even the village gossip is disappointed."] : []), "", "!replay · Reveal the finished game's full timeline"
  ].join("\n");
}
