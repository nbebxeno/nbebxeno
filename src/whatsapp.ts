import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import * as qrcodeImage from "qrcode";
import { GameError } from "./engine.ts";
import { GameSessions } from "./session.ts";
import { StatsStore } from "./stats.ts";
import { helpText, resolveCommand, normalizeCommand } from "./commands.ts";
import { roleCard, lobbyCard, rosterCard, statusCard, rolesCard, roleLabel, factionLabel, deceasedLabel } from "./presentation.ts";

const authDirectory = "./.auth/lordxeno";
const qrImagePath = `${authDirectory}/whatsapp-qr.png`;
const sessions = new GameSessions({ tieRule: "no-elimination", revealRoleOnDeath: true }, "./.data/lordxeno-games.json");
const DISCUSSION_MS = 120_000;
const phaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
const phaseDeadlines = new Map<string, number>();
const duplicateJoinWarnings = new Set<string>();
const commandCooldowns = new Map<string, number>();
const stats = new StatsStore();
let activeSocket: ReturnType<typeof makeWASocket> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function messageText(message: { conversation?: string | null; extendedTextMessage?: { text?: string | null } | null }): string {
  return message.conversation ?? message.extendedTextMessage?.text ?? "";
}

function roleMessage(view: ReturnType<GameSessions["startGame"]>["privateViews"][number]): string {
  return roleCard(view);
}

function lobbyMessage(snapshot: ReturnType<GameSessions["snapshot"]>): string {
  return lobbyCard(snapshot, sessions.mode(snapshot.groupId));
}

function rosterMessage(groupId: string): string {
  return rosterCard(sessions.gameSnapshot(groupId));
}

function nightPrompt(role: string): string {
  if (role === "werewolf") return "🌑 *NIGHT ACTION*\n\nChoose a living player to target. Reply with !night <player number>.";
  if (role === "seer") return "🔮 *NIGHT ACTION*\n\nChoose a living player to investigate. Reply with !night <player number>.";
  if (role === "doctor") return "🩺 *NIGHT ACTION*\n\nChoose a living player to protect. Reply with !night <player number>.";
  return "🌑 *NIGHT*\n\nRest until dawn. No night action is needed from you.";
}

function schedulePhaseTimer(groupId: string, milliseconds: number, callback: () => void, nextPhase?: "night" | "voting"): void {
  const previous = phaseTimers.get(groupId);
  if (previous) clearTimeout(previous);
  phaseDeadlines.set(groupId, Date.now() + milliseconds);
  sessions.setPhaseDeadline(groupId, Date.now() + milliseconds, nextPhase);
  phaseTimers.set(groupId, setTimeout(() => {
    phaseTimers.delete(groupId);
    phaseDeadlines.delete(groupId);
    callback();
  }, milliseconds));
}

function clearPhaseTimer(groupId: string): void {
  const timer = phaseTimers.get(groupId);
  if (timer) clearTimeout(timer);
  phaseTimers.delete(groupId);
  phaseDeadlines.delete(groupId);
  try { sessions.setPhaseDeadline(groupId, undefined); } catch { /* session may already be gone */ }
}

function logPhaseTransition(groupId: string, phase: string, trigger: string): void {
  console.log(`[phase] ${new Date().toISOString()} group=${groupId} phase=${phase} trigger=${trigger}`);
}

function remainingSeconds(groupId: string): number | null {
  const deadline = phaseDeadlines.get(groupId);
  return deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : null;
}

function recordCompletedGame(groupId: string): void {
  const result = sessions.completedRecord(groupId);
  if (!result) return;
  for (const player of result.players) stats.record(player.id, player.role, player.faction === result.winner || result.individualWinners.includes(player.id), player.lynched, player.alive);
  stats.addChronicle(`${new Date().toISOString().slice(0, 10)}: ${result.winner} victory in ${groupId}; ${result.players.length} players summoned.`);
}

async function isGroupAdmin(socket: ReturnType<typeof makeWASocket>, groupId: string, identity: string): Promise<boolean> {
  const metadata = await socket.groupMetadata(groupId);
  const normalizedIdentity = identity.split("@")[0].replace(/\D/g, "");
  return metadata.participants.some((participant) => {
    const normalizedParticipant = participant.id.split("@")[0].replace(/\D/g, "");
    return (participant.id === identity || normalizedParticipant === normalizedIdentity) && (participant.admin === "admin" || participant.admin === "superadmin");
  });
}

function participantIdentity(message: { key: { participant?: string | null; participantPn?: string | null; remoteJid?: string | null } }): string {
  return message.key.participantPn ?? message.key.participant ?? message.key.remoteJid ?? "";
}

async function safeSend(socket: ReturnType<typeof makeWASocket>, jid: string, text: string): Promise<void> {
  const [user, server] = jid.split("@");
  if (!user || !server) {
    console.error("WhatsApp message skipped because the destination is not a valid JID.");
    return;
  }
  try {
    await socket.sendMessage(jid, { text });
  } catch (error) {
    console.error("WhatsApp message was not sent:", error instanceof Error ? error.message : error);
  }
}

async function startWhatsApp(): Promise<void> {
  if (activeSocket) return;
  const { state, saveCreds } = await useMultiFileAuthState(authDirectory);
  const socket = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  });
  activeSocket = socket;

  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("Scan this QR code from WhatsApp > Linked devices:");
      qrcodeTerminal.generate(qr, { small: true });
      await qrcodeImage.toFile(qrImagePath, qr, { width: 600, margin: 2 });
      console.log(`QR image saved to ${qrImagePath}`);
    }
    if (connection === "open") {
      console.log("lordxeno is connected to WhatsApp.");
      resumeSavedTimers(socket);
    }
    if (connection === "close") {
      if (activeSocket !== socket) return;
      activeSocket = null;
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        if (!reconnectTimer) {
          console.log("WhatsApp connection closed. Reconnecting once...");
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            void startWhatsApp().catch((error) => console.error("WhatsApp reconnect failed:", error));
          }, 2_000);
        }
      } else {
        console.error("WhatsApp session was logged out. Delete .auth/lordxeno and pair again.");
      }
    }
  });

  socket.ev.on("messages.upsert", async ({ messages }) => {
    for (const message of messages) {
      if (message.key.fromMe || !message.message || !message.key.remoteJid) continue;
      const remoteJid = message.key.remoteJid;
      const text = messageText(message.message).trim();
      const command = normalizeCommand(text);
      const commandName = resolveCommand(command)?.name;
      if (!commandName) continue;
      const commandKey = `${message.key.remoteJid}:${participantIdentity(message)}:${command}`;
      const lastCommand = commandCooldowns.get(commandKey) ?? 0;
      if (Date.now() - lastCommand < 750) continue;
      commandCooldowns.set(commandKey, Date.now());
      if (commandName === "ping") {
        await safeSend(socket, message.key.remoteJid, "lordxeno transport online.");
        continue;
      }
      if (commandName === "help") {
        await safeSend(socket, message.key.remoteJid, helpText());
        continue;
      }
      const participantAlias = message.key.participant;
      const joinWarningKey = `${remoteJid}:${participantIdentity(message)}`;
      const groupIdentity = participantIdentity(message);
      const sender = { id: groupIdentity, displayName: message.pushName ?? groupIdentity };
      try {
        if (!message.key.remoteJid.endsWith("@g.us") && commandName === "night") {
          const targetNumber = Number(command.slice("!xeno night ".length).trim());
          if (!Number.isInteger(targetNumber)) throw new GameError("Choose a player number, for example: !night 2");
          sessions.submitNightAction(sessions.groupForIdentity(message.key.remoteJid), message.key.remoteJid, targetNumber);
          await safeSend(socket, message.key.remoteJid, "Your night action has been recorded. Await dawn.");
          const actionGroupId = sessions.groupForIdentity(message.key.remoteJid);
          if (sessions.allNightActionsSubmitted(actionGroupId)) void resolveNightPhase(socket, actionGroupId, false);
          continue;
        }
        if (!message.key.remoteJid.endsWith("@g.us") && commandName === "vote") {
          const targetNumber = Number(command.slice("!xeno vote ".length).trim());
          if (!Number.isInteger(targetNumber)) throw new GameError("Vote with a player number, for example: !vote 2");
          const voteGroupId = sessions.groupForIdentity(message.key.remoteJid);
          sessions.submitVote(voteGroupId, message.key.remoteJid, targetNumber);
          await safeSend(socket, message.key.remoteJid, "✅ Your vote has been recorded. Await the result.");
          if (sessions.allVotesSubmitted(voteGroupId)) void resolveVotePhase(socket, voteGroupId, "all-votes-submitted");
          continue;
        }
        if (!message.key.remoteJid.endsWith("@g.us") && commandName === "unvote") {
          const voteGroupId = sessions.groupForIdentity(message.key.remoteJid);
          sessions.unvote(voteGroupId, message.key.remoteJid);
          await safeSend(socket, message.key.remoteJid, "✅ Your vote has been retracted.");
          continue;
        }
        if (!message.key.remoteJid.endsWith("@g.us") || !command.startsWith("!xeno ")) continue;
        if (commandName === "lobby") {
          clearPhaseTimer(remoteJid);
          await safeSend(socket, message.key.remoteJid, lobbyMessage(sessions.createLobby(message.key.remoteJid, sender)));
          if (participantAlias && participantAlias !== groupIdentity) sessions.registerAlias(remoteJid, groupIdentity, participantAlias);
        } else if (commandName === "mode") {
          const mode = command.slice("!xeno mode ".length).trim();
          if (mode !== "classic" && mode !== "beginner" && mode !== "chaos") throw new GameError("Choose classic, beginner, or chaos.");
          sessions.setMode(remoteJid, groupIdentity, mode);
          await safeSend(socket, remoteJid, lobbyMessage(sessions.snapshot(remoteJid)));
        } else if (commandName === "join") {
          if (!sessions.mode(remoteJid)) throw new GameError("The host must choose a game mode before players join.");
          const lobby = sessions.joinLobby(remoteJid, sender);
          duplicateJoinWarnings.delete(joinWarningKey);
          await safeSend(socket, remoteJid, lobbyMessage(lobby));
          if (participantAlias && participantAlias !== groupIdentity) sessions.registerAlias(remoteJid, groupIdentity, participantAlias);
        } else if (commandName === "leave") {
          sessions.leaveLobby(message.key.remoteJid, groupIdentity);
          duplicateJoinWarnings.delete(joinWarningKey);
          await safeSend(socket, message.key.remoteJid, `${sender.displayName} left the lobby.`);
        } else if (commandName === "players") {
          const lobby = sessions.snapshot(message.key.remoteJid);
          await safeSend(socket, message.key.remoteJid, lobby.started ? rosterMessage(message.key.remoteJid) : lobbyMessage(lobby));
        } else if (commandName === "start") {
          const started = sessions.startGame(message.key.remoteJid, groupIdentity);
          await safeSend(socket, message.key.remoteJid, "🌘 *LORDXENO · THE SUMMONING*\n\nYour secret role is arriving by private message. Keep it to yourself.");
          for (const view of started.privateViews) await safeSend(socket, view.player.id, roleMessage(view));
          void enterPhase(socket, remoteJid, "discussion", "☀️ *DAY 1 · DISCUSSION*\n\nYou have 2 minutes. Discuss in the group; voting opens after the first night.", "night");
        } else if (commandName === "status") {
          const lobby = sessions.snapshot(remoteJid);
          if (!lobby.started) {
            await safeSend(socket, remoteJid, lobbyMessage(lobby));
            continue;
          }
          const view = sessions.gameSnapshot(remoteJid);
          const seconds = remainingSeconds(remoteJid);
          await safeSend(socket, remoteJid, statusCard(view, seconds));
        } else if (commandName === "roles") {
          await safeSend(socket, remoteJid, rolesCard(sessions.roleSummaries(remoteJid)));
        } else if (commandName === "myrole") {
          const view = sessions.privateView(remoteJid, groupIdentity);
          await safeSend(socket, groupIdentity, roleMessage(view));
          await safeSend(socket, remoteJid, `${sender.displayName}, your role reminder was sent privately.`);
        } else if (commandName === "graveyard") {
          const deaths = sessions.graveyard(remoteJid);
          const view = sessions.gameSnapshot(remoteJid);
          const message = deaths.length === 0 ? "The graveyard is empty." : deaths.map((death) => {
            return `• ${deceasedLabel(view, death.playerId)} (${death.cause === "vote" ? "Day vote" : death.cause === "night-attack" ? "Night attack" : "Unknown cause"})`;
          }).join("\n");
          await safeSend(socket, remoteJid, `🪦 *LORDXENO · GRAVEYARD*\n\n${message}`);
        } else if (commandName === "vote") {
          throw new GameError("Voting happens privately. Check your DM from lordxeno.");
        } else if (commandName === "unvote") {
          throw new GameError("Retract your vote privately with !unvote in DM.");
        } else if (commandName === "votes") {
          const tally = sessions.voteSnapshot(remoteJid);
          const view = sessions.gameSnapshot(remoteJid);
          const lines = Object.entries(tally.counts).map(([targetId, count]) => `${view.players.find((player) => player.id === targetId)?.displayName ?? targetId}: ${count}`);
          await safeSend(socket, remoteJid, `🗳️ VOTES\n\n${lines.length ? lines.join("\n") : "No votes yet."}`);
        } else if (commandName === "resolve") {
          await resolveVotePhase(socket, remoteJid, "manual");
        } else if (commandName === "night-resolve") {
          await resolveNightPhase(socket, remoteJid, false);
        } else if (commandName === "stats") {
          const current = stats.get(groupIdentity);
          const favorite = Object.entries(current.roles).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "none";
          await safeSend(socket, remoteJid, `📊 STATS\n\nGames: ${current.games}\nWins: ${current.wins}\nWin rate: ${current.games ? Math.round(current.wins / current.games * 100) : 0}%\nLynched: ${current.lynched}\nSurvived to end: ${current.survived}\nMost played role: ${favorite === "none" ? "None yet" : roleLabel(favorite)}`);
        } else if (commandName === "chronicle") {
          await safeSend(socket, remoteJid, `📖 VILLAGE CHRONICLE\n\n${stats.chronicle().join("\n") || "No legends have been recorded yet."}`);
        } else if (commandName === "leaderboard") {
          const entries = stats.leaderboard().map((entry, index) => `${index + 1}. ${entry.id} - ${entry.wins} wins`).join("\n");
          await safeSend(socket, remoteJid, `🏆 LEADERBOARD\n\n${entries || "No players have completed a recorded game yet."}`);
        } else if (commandName === "kick") {
          if (!await isGroupAdmin(socket, remoteJid, groupIdentity)) throw new GameError("Only a group admin can kick players.");
          const targetNumber = Number(command.slice("!xeno kick ".length).trim());
          if (!Number.isInteger(targetNumber)) throw new GameError("Kick a lobby player by number.");
          const lobby = sessions.snapshot(remoteJid);
          const target = lobby.players[targetNumber - 1];
          if (!target) throw new GameError("That lobby player number does not exist.");
          sessions.kick(remoteJid, groupIdentity, target.id);
          await safeSend(socket, remoteJid, `${target.displayName} was removed from the lobby.`);
        } else if (commandName === "endgame") {
          if (!await isGroupAdmin(socket, remoteJid, groupIdentity)) throw new GameError("Only a group admin can end the game.");
          clearPhaseTimer(remoteJid);
          sessions.endGame(remoteJid);
          await safeSend(socket, remoteJid, "⚠️ This game has been force-ended by an admin.");
        } else if (commandName === "settings") {
          await safeSend(socket, remoteJid, `⚙️ *LORDXENO · SETTINGS*\n\nMode: ${roleLabel(sessions.mode(remoteJid) ?? "classic")}\nDefault roles: ${sessions.settings(remoteJid).map(roleLabel).join(", ")}\n\nThe selected mode chooses the role pool. Custom role selection is not available yet.`);
        }
      } catch (error) {
        if (commandName === "join" && error instanceof GameError && error.message === "You're already in the lobby.") {
          if (duplicateJoinWarnings.has(joinWarningKey)) continue;
          duplicateJoinWarnings.add(joinWarningKey);
        }
        const response = error instanceof GameError ? error.message : "The command could not be completed.";
        await safeSend(socket, message.key.remoteJid, response);
      }
    }
  });
}

function resumeSavedTimers(socket: ReturnType<typeof makeWASocket>): void {
  for (const game of sessions.resumableGames()) {
    const milliseconds = Math.max(0, (game.deadline ?? Date.now()) - Date.now());
    if (game.phase === "discussion") {
      const nextPhase = game.nextPhase ?? "night";
      schedulePhaseTimer(game.groupId, milliseconds, () => void enterPhase(socket, game.groupId, nextPhase, nextPhase === "night" ? "Night falls." : "Voting is now open.", "night"), nextPhase);
    } else if (game.phase === "night") {
      schedulePhaseTimer(game.groupId, milliseconds, () => void resolveNightPhase(socket, game.groupId, true));
    } else if (game.phase === "voting") {
      schedulePhaseTimer(game.groupId, milliseconds, () => void resolveVotePhase(socket, game.groupId));
    }
  }
}

async function enterPhase(socket: ReturnType<typeof makeWASocket>, groupId: string, phase: "discussion" | "night" | "voting", message: string, discussionNext: "night" | "voting" = "night"): Promise<void> {
  clearPhaseTimer(groupId);
  logPhaseTransition(groupId, phase, "phase-entry");
  try {
    if (phase === "discussion") {
      await setDiscussionAccess(socket, groupId);
      await safeSend(socket, groupId, message);
      schedulePhaseTimer(groupId, DISCUSSION_MS, () => void enterPhase(socket, groupId, discussionNext, discussionNext === "night" ? "🌑 NIGHT FALLS" : "⚖️ VOTING IS OPEN", "night"), discussionNext);
      return;
    }
    if (phase === "night") {
      if (sessions.gameSnapshot(groupId).phase === "discussion") sessions.beginNight(groupId);
      if (sessions.gameSnapshot(groupId).status === "ended") {
        await safeSend(socket, groupId, `${sessions.gameSnapshot(groupId).winner?.toUpperCase()} WINS.`);
        recordCompletedGame(groupId);
        return;
      }
      else if (sessions.gameSnapshot(groupId).phase !== "night") throw new GameError("Night cannot begin from the current phase.");
      await setNightAccess(socket, groupId);
      await safeSend(socket, groupId, "🌑 NIGHT FALLS\n\nDiscussion is closed. Night actions are being requested privately. You have 60 seconds.");
      const targets = rosterMessage(groupId);
      for (const actorId of sessions.nightActors(groupId)) {
        const actorView = sessions.privateView(groupId, actorId);
        await safeSend(socket, actorId, `${nightPrompt(actorView.role)}\n\nTime remaining: 60 seconds.\n\n${targets}`);
      }
      schedulePhaseTimer(groupId, 60_000, () => void resolveNightPhase(socket, groupId, true));
      return;
    }
    if (sessions.gameSnapshot(groupId).phase === "discussion") sessions.beginVoting(groupId);
    if (sessions.gameSnapshot(groupId).status === "ended") {
      await safeSend(socket, groupId, `${sessions.gameSnapshot(groupId).winner?.toUpperCase()} WINS.`);
      recordCompletedGame(groupId);
      return;
    }
    else if (sessions.gameSnapshot(groupId).phase !== "voting") throw new GameError("Voting cannot begin from the current phase.");
    await setNightAccess(socket, groupId);
    await safeSend(socket, groupId, "⚖️ *VOTING IS OPEN*\n\nTime: 60 seconds\nCheck your private messages to vote.\nThe group is locked until the result.");
    const voteTargets = rosterMessage(groupId);
    for (const player of sessions.gameSnapshot(groupId).players.filter((candidate) => candidate.alive)) {
      await safeSend(socket, player.id, `⚖️ *YOUR VOTE*\n\nTime: 60 seconds\n\n${voteTargets}\n\nReply here: !vote <number>\nUndo: !unvote\n\nExample: !vote 2\nMissing votes are skipped when time runs out.`);
    }
    schedulePhaseTimer(groupId, 60_000, () => void resolveVotePhase(socket, groupId));
  } catch (error) {
    await safeSend(socket, groupId, error instanceof GameError ? error.message : "Night could not begin.");
  }
}

async function resolveNightPhase(socket: ReturnType<typeof makeWASocket>, groupId: string, force: boolean): Promise<void> {
  clearPhaseTimer(groupId);
  logPhaseTransition(groupId, "night-resolution", force ? "timer" : "all-actions-submitted");
  try {
    const result = sessions.resolveNight(groupId, force);
    const publicView = sessions.gameSnapshot(groupId);
    for (const investigation of result.investigations) {
      await safeSend(socket, investigation.seerId, `🔮 DIVINATION RESULT\n\n${publicView.players.find((player) => player.id === investigation.targetId)?.displayName ?? investigation.targetId} belongs to the ${factionLabel(investigation.faction)} faction.`);
    }
    const deaths = result.deaths.map((id) => deceasedLabel(publicView, id));
    const dawn = deaths.length ? `🌅 DAWN\n\n${deaths.join(" and ")} did not survive the night.` : "🌅 DAWN\n\nThe darkness recedes. No one was lost this night.";
    if (result.winner) {
      await safeSend(socket, groupId, `${dawn}\n\n${result.winner.toUpperCase()} WINS.`);
      recordCompletedGame(groupId);
    }
    if (!result.winner) void enterPhase(socket, groupId, "discussion", `${dawn}\n\nDay ${publicView.dayNumber} discussion begins. You have 2 minutes.`, "voting");
  } catch (error) {
    await safeSend(socket, groupId, error instanceof GameError ? error.message : "Night could not be resolved.");
  }
}

async function resolveVotePhase(socket: ReturnType<typeof makeWASocket>, groupId: string, trigger: "timer" | "all-votes-submitted" | "manual" = "timer"): Promise<void> {
  logPhaseTransition(groupId, "vote-resolution", trigger);
  try {
    const result = sessions.resolveVote(groupId, trigger === "timer");
    clearPhaseTimer(groupId);
    const view = sessions.gameSnapshot(groupId);
    const death = result.eliminatedPlayerId ? view.players.find((player) => player.id === result.eliminatedPlayerId) : null;
    if (death && sessions.gameSnapshot(groupId).individualWinners.includes(death.id)) {
      await safeSend(socket, groupId, `${death.displayName} achieved their individual lynching win. Other factions can still win.`);
    }
    await safeSend(socket, groupId, death ? `⚖️ VOTE RESOLVED\n\n${deceasedLabel(view, death.id)} has been eliminated.` : "⚖️ VOTE RESOLVED\n\nNo eligible vote was received or the vote tied.");
    if (result.winner) {
      await safeSend(socket, groupId, `${result.winner.toUpperCase()} WINS.`);
      recordCompletedGame(groupId);
    } else {
      void enterPhase(socket, groupId, "night", "🌑 NIGHT FALLS", "night");
    }
  } catch (error) {
    await safeSend(socket, groupId, error instanceof GameError ? error.message : "Voting could not be resolved.");
  }
}

async function setNightAccess(socket: ReturnType<typeof makeWASocket>, groupId: string): Promise<void> {
  try {
    await socket.groupSettingUpdate(groupId, "announcement");
  } catch (error) {
    console.error(`Could not lock ${groupId}; the bot may not be a group admin.`, error instanceof Error ? error.message : error);
  }
}

async function setDiscussionAccess(socket: ReturnType<typeof makeWASocket>, groupId: string): Promise<void> {
  try {
    await socket.groupSettingUpdate(groupId, "not_announcement");
  } catch (error) {
    console.error(`Could not open ${groupId}; the bot may not be a group admin.`, error instanceof Error ? error.message : error);
  }
}

void startWhatsApp();
