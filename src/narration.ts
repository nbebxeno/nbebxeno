import type { DeathRecord } from "./engine.ts";

export const VILLAGE_NAME = "Briar Hollow";
function pick(lines: string[], key: string): string {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  return lines[(hash >>> 0) % lines.length];
}
export function discussionStory(day: number, seed = ""): string {
  return pick([
    `The bell rings across ${VILLAGE_NAME}. Everyone gathers in the square, carrying theories and absolutely no evidence.`,
    `Another morning in ${VILLAGE_NAME}. The mayor clears their throat. The baker immediately looks suspicious.`,
    "The villagers gather beside the old well. Someone has brought a pitchfork. Someone else has brought snacks. Priorities."
  ], `${seed}-discussion-${day}`);
}
export function nightStory(night: number, seed = ""): string {
  return pick([
    "Lanterns go out, doors are bolted, and someone insists that howling was just a very upset dog.",
    `Moonlight settles over ${VILLAGE_NAME}. The tavern shuts early. For once, nobody complains.`,
    "The square empties. Behind shuttered windows, the village makes plans it will deny making tomorrow."
  ], `${seed}-night-${night}`);
}
export function votingStory(day: number, seed = ""): string {
  return pick([
    "The village clerk opens the ballot box. Confidence is high. Accuracy remains unconfirmed.",
    "The square falls quiet. It is time to turn those very strong opinions into a vote.",
    "The bell tolls once. The mayor asks for calm, which naturally makes everyone more suspicious."
  ], `${seed}-vote-${day}`);
}
export function dawnStory(day: number, deaths: Array<DeathRecord & { displayName: string }>, seed = ""): string {
  if (!deaths.length) return pick([
    "Morning arrives. Every candle still has an owner. The baker takes credit; nobody remembers asking.",
    `Dawn finds ${VILLAGE_NAME} remarkably alive. Everyone gathers in the square to act like they were never scared.`,
    "The sun rises. Nobody died. For five glorious seconds, the village considers being normal."
  ], `${seed}-peace-${day}`);
  return deaths.map((death) => {
    const name = death.displayName;
    if (death.cause === "night-attack" && death.attackKind === "pack") return pick([
      `${name} stepped outside to investigate a noise. The noise had fur, teeth, and a very poor attitude. A werewolf claimed them.`,
      `${name} went to fetch water after dark. The bucket returned. ${name} did not. The werewolves got there first.`,
      `${name} decided the shortcut through the woods was fine. The werewolves, unfortunately, agreed.`
    ], `${seed}-${day}-${name}`);
    if (death.cause === "poison") return `${name} accepted a suspicious midnight drink. The village has now added “ask what is in it” to its advice board.`;
    if (death.cause === "fire") return `${name}'s night ended in flames. The village fire brigade has once again proved mostly decorative.`;
    if (death.cause === "heartbreak") return `${name} could not bear the loss of their linked partner. Two candles went dark together.`;
    return `${name} did not make it back before dawn. Something moved through the dark, and it was not delivering good news.`;
  }).join("\n\n");
}
export function verdictStory(name: string | null): string {
  return name ? `${name} leaves the square under the village's verdict. Several people are already preparing to say they “had doubts”.` : "The ballot box closes without a death. The village returns to arguing with renewed confidence.";
}
