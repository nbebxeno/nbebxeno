import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import * as qrcodeImage from "qrcode";
import { GameError } from "./engine.ts";
import { GameSessions } from "./session.ts";
import { StatsStore } from "./stats.ts";
import { helpText, resolveCommand, normalizeCommand } from "./commands.ts";
import { roleCard, lobbyCard, rosterCard, statusCard, rolesCard, roleLabel, deceasedLabel } from "./presentation.ts";

const authDirectory = "./.auth/lordxeno";
const qrImagePath = `${authDirectory}/whatsapp-qr.png`;
const sessions = new GameSessions({ tieRule: "no-elimination", revealRoleOnDeath: true }, "./.data/lordxeno-games.json");
const phaseTransitions = new Set<string>();
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
  for (const player of result.players) stats.record(player.id, player.role, (result.winner !== "neutral" && player.faction === result.winner) || result.individualWinners.includes(player.id), player.lynched, player.alive);
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

function participantIdentity(message: { key: { participant?: string | null; participantPn?: string | null; participantAlt?: string | null; remoteJid?: string | null } }): string {
  const candidates = [message.key.participantPn, message.key.participantAlt, message.key.participant];
  return candidates.find((id) => id?.endsWith("@s.whatsapp.net")) ?? message.key.participant ?? message.key.remoteJid ?? "";
}

function locatePrivateGame(jid: string, alternate?: string | null): string {
  try { return sessions.groupForIdentity(jid); }
  catch (error) {
    if (!alternate || !(error instanceof GameError) || !error.message.startsWith("Unknown player")) throw error;
    const groupId = sessions.groupForIdentity(alternate);
    sessions.registerAlias(groupId, sessions.resolvePlayerId(groupId, alternate), jid);
    return groupId;
  }
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
      const participantAlias = message.key.participant === participantIdentity(message) ? message.key.participantAlt : message.key.participant;
      const joinWarningKey = `${remoteJid}:${participantIdentity(message)}`;
      const groupIdentity = participantIdentity(message);
      const sender = { id: groupIdentity, displayName: message.pushName ?? groupIdentity };
      try {
        if (!remoteJid.endsWith("@g.us") && ["actions", "act", "skip", "myrole"].includes(commandName)) {
          const actionGroupId = locatePrivateGame(remoteJid, message.key.remoteJidAlt);
          if (commandName === "actions") {
            await safeSend(socket, remoteJid, sessions.actionPrompt(actionGroupId, remoteJid));
          } else if (commandName === "myrole") {
            await safeSend(socket, remoteJid, roleMessage(sessions.privateView(actionGroupId, sessions.resolvePlayerId(actionGroupId, remoteJid))));
          } else {
            const previousPhase = sessions.gameSnapshot(actionGroupId).phase;
            if (commandName === "skip") sessions.skipAction(actionGroupId, remoteJid);
            else {
              const [ability, ...args] = command.slice("!xeno act ".length).split(" ");
              sessions.submitRoleAction(actionGroupId, remoteJid, ability, args);
            }
            await safeSend(socket, remoteJid, commandName === "skip" ? "Remaining abilities skipped for this phase. Your vote is separate." : "✅ Your ability has been recorded.");
            await flushEvents(socket, actionGroupId);
            const phase = sessions.gameSnapshot(actionGroupId).phase;
            if (!phaseTransitions.has(actionGroupId)) {
              if (previousPhase === "reaction") await continueGame(socket, actionGroupId);
              else if (phase === "night" && sessions.allNightActionsSubmitted(actionGroupId)) await resolveNightPhase(socket, actionGroupId, false);
              else if (phase === "voting" && sessions.allVotesSubmitted(actionGroupId)) await resolveVotePhase(socket, actionGroupId, "all-votes-submitted");
              else if (commandName === "act" || commandName === "skip") {
                if (phase === "reaction") await enterReaction(socket, actionGroupId);
                else if (phase === "ended" || (phase !== "night" && phase !== "voting")) await continueGame(socket, actionGroupId);
              }
            }
          }
          continue;
        }
        if (!message.key.remoteJid.endsWith("@g.us") && commandName === "night") {
          const targetNumber = Number(command.slice("!xeno night ".length).trim());
          if (!Number.isInteger(targetNumber)) throw new GameError("Choose a player number, for example: !night 2");
          sessions.submitNightAction(locatePrivateGame(remoteJid, message.key.remoteJidAlt), message.key.remoteJid, targetNumber);
          await safeSend(socket, message.key.remoteJid, "Your night action has been recorded. Await dawn.");
          const actionGroupId = locatePrivateGame(remoteJid, message.key.remoteJidAlt);
          if (!phaseTransitions.has(actionGroupId) && sessions.allNightActionsSubmitted(actionGroupId)) await resolveNightPhase(socket, actionGroupId, false);
          continue;
        }
        if (!message.key.remoteJid.endsWith("@g.us") && commandName === "vote") {
          const targetNumber = Number(command.slice("!xeno vote ".length).trim());
          if (!Number.isInteger(targetNumber)) throw new GameError("Vote with a player number, for example: !vote 2");
          const voteGroupId = locatePrivateGame(remoteJid, message.key.remoteJidAlt);
          sessions.submitVote(voteGroupId, message.key.remoteJid, targetNumber);
          await safeSend(socket, message.key.remoteJid, "✅ Your vote has been recorded. Await the result.");
          if (!phaseTransitions.has(voteGroupId) && sessions.allVotesSubmitted(voteGroupId)) await resolveVotePhase(socket, voteGroupId, "all-votes-submitted");
          continue;
        }
        if (!message.key.remoteJid.endsWith("@g.us") && commandName === "unvote") {
          const voteGroupId = locatePrivateGame(remoteJid, message.key.remoteJidAlt);
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
            return `• ${deceasedLabel(view, death.playerId)} (${death.cause === "undefined" ? "Unknown cause" : roleLabel(death.cause)})`;
          }).join("\n");
          await safeSend(socket, remoteJid, `🪦 *LORDXENO · GRAVEYARD*\n\n${message}`);
        } else if (["act", "actions", "skip"].includes(commandName)) {
          await safeSend(socket, groupIdentity, sessions.actionPrompt(remoteJid, groupIdentity));
          await safeSend(socket, remoteJid, "Your abilities were sent privately. Use powers and !skip in DM.");
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
    } else if (game.phase === "reaction") {
      void enterReaction(socket, game.groupId, milliseconds);
    } else if (game.phase === "voting") {
      schedulePhaseTimer(game.groupId, milliseconds, () => void resolveVotePhase(socket, game.groupId));
    }
  }
}

async function flushEvents(socket: ReturnType<typeof makeWASocket>, groupId: string): Promise<void> {
  for (const event of sessions.drainEvents(groupId)) await safeSend(socket, event.recipient ?? groupId, event.text);
}

async function continueGame(socket: ReturnType<typeof makeWASocket>, groupId: string, message?: string): Promise<void> {
  await flushEvents(socket, groupId);
  const view = sessions.gameSnapshot(groupId);
  if (view.status === "ended") {
    clearPhaseTimer(groupId);
    if (message) await safeSend(socket, groupId, message);
    await safeSend(socket, groupId, view.winner === "neutral" ? "The game has ended. Personal winners are announced separately." : `${view.winner?.toUpperCase()} WINS.`);
    recordCompletedGame(groupId);
    return;
  }
  if (view.phase === "reaction") {
    if (message) await safeSend(socket, groupId, message);
    await enterReaction(socket, groupId);
  } else if (view.phase === "discussion") {
    const seconds = sessions.discussionMilliseconds(groupId) / 1000;
    await enterPhase(socket, groupId, "discussion", `${message ? `${message}\n\n` : ""}☀️ *DAY ${view.dayNumber} · DISCUSSION*\n\nYou have ${seconds} seconds.`, "voting");
  } else if (view.phase === "night") await enterPhase(socket, groupId, "night", "Night falls.");
}

async function enterReaction(socket: ReturnType<typeof makeWASocket>, groupId: string, milliseconds = 30_000): Promise<void> {
  if (phaseTransitions.has(groupId)) return;
  phaseTransitions.add(groupId);
  clearPhaseTimer(groupId);
  try {
    await setNightAccess(socket, groupId);
    await safeSend(socket, groupId, "A final role action is pending. The game is paused for up to 30 seconds.");
    for (const id of sessions.reactionActors(groupId)) await safeSend(socket, id, sessions.actionPrompt(groupId, id));
    if (sessions.gameSnapshot(groupId).phase === "reaction") schedulePhaseTimer(groupId, milliseconds, () => {
      sessions.expireReactions(groupId);
      void continueGame(socket, groupId);
    });
  } finally { phaseTransitions.delete(groupId); }
  if (sessions.gameSnapshot(groupId).phase !== "reaction") await continueGame(socket, groupId);
}

async function enterPhase(socket: ReturnType<typeof makeWASocket>, groupId: string, phase: "discussion" | "night" | "voting", message: string, discussionNext: "night" | "voting" = "night"): Promise<void> {
  if (phaseTransitions.has(groupId)) return;
  phaseTransitions.add(groupId);
  clearPhaseTimer(groupId);
  logPhaseTransition(groupId, phase, "phase-entry");
  try {
    if (phase === "discussion") {
      await setDiscussionAccess(socket, groupId);
      await safeSend(socket, groupId, message);
      schedulePhaseTimer(groupId, sessions.discussionMilliseconds(groupId), () => void enterPhase(socket, groupId, discussionNext, discussionNext === "night" ? "🌑 NIGHT FALLS" : "⚖️ VOTING IS OPEN", "night"), discussionNext);
    } else {
      if (sessions.gameSnapshot(groupId).phase === "discussion") {
        if (phase === "night") sessions.beginNight(groupId);
        else sessions.beginVoting(groupId);
      }
      const current = sessions.gameSnapshot(groupId);
      if (current.status === "ended") {
        await safeSend(socket, groupId, current.winner === "neutral" ? "The game has ended. See personal winner announcements." : `${current.winner?.toUpperCase()} WINS.`);
        await flushEvents(socket, groupId); recordCompletedGame(groupId); return;
      }
      const actual = current.phase;
      if (actual !== "night" && actual !== "voting") throw new GameError("This phase cannot begin now.");
      await setNightAccess(socket, groupId);
      await flushEvents(socket, groupId);
      await safeSend(socket, groupId, actual === "night" ? "🌑 *NIGHT FALLS*\n\nTime: 60 seconds. Check your private messages for your role actions." : "⚖️ *VOTING IS OPEN*\n\nTime: 60 seconds. Vote and use any voting powers privately.");
      const actors = sessions.actionActors(groupId);
      for (const player of current.players.filter((player) => player.alive)) {
        if (actual === "voting") await safeSend(socket, player.id, `⚖️ *YOUR VOTE*\n\nTime: 60 seconds\n\n${rosterMessage(groupId)}\n\nReply here: !vote <number>\nUndo: !unvote\nMissing votes are skipped at timeout.`);
        if (actors.includes(player.id)) await safeSend(socket, player.id, `${sessions.actionPrompt(groupId, player.id)}\n\nTime: 60 seconds.`);
        else if (actual === "night") await safeSend(socket, player.id, "🌑 *NIGHT*\n\nYour role has no active choice tonight. Passive powers apply automatically. Wait for dawn.");
      }
      schedulePhaseTimer(groupId, 60_000, () => actual === "night" ? void resolveNightPhase(socket, groupId, true) : void resolveVotePhase(socket, groupId));
    }
  } catch (error) {
    await safeSend(socket, groupId, error instanceof GameError ? error.message : "The phase could not begin.");
  } finally { phaseTransitions.delete(groupId); }
  const current = sessions.gameSnapshot(groupId);
  if (current.phase === "night" && sessions.allNightActionsSubmitted(groupId)) await resolveNightPhase(socket, groupId, false);
  else if (current.phase === "voting" && sessions.allVotesSubmitted(groupId)) await resolveVotePhase(socket, groupId, "all-votes-submitted");
}

async function resolveNightPhase(socket: ReturnType<typeof makeWASocket>, groupId: string, force: boolean): Promise<void> {
  if (phaseTransitions.has(groupId)) return;
  phaseTransitions.add(groupId);
  logPhaseTransition(groupId, "night-resolution", force ? "timer" : "all-actions-submitted");
  let dawn: string | undefined;
  try {
    const result = sessions.resolveNight(groupId, force);
    clearPhaseTimer(groupId);
    const view = sessions.gameSnapshot(groupId);
    const deaths = result.deaths.map((id) => deceasedLabel(view, id));
    dawn = deaths.length ? `🌅 *DAWN*\n\n${deaths.join("\n")} did not survive the night.` : "🌅 *DAWN*\n\nNo one was lost this night.";
  } catch (error) {
    await safeSend(socket, groupId, error instanceof GameError ? error.message : "Night could not be resolved.");
  } finally { phaseTransitions.delete(groupId); }
  if (dawn) await continueGame(socket, groupId, dawn);
}

async function resolveVotePhase(socket: ReturnType<typeof makeWASocket>, groupId: string, trigger: "timer" | "all-votes-submitted" | "manual" = "timer"): Promise<void> {
  if (phaseTransitions.has(groupId)) return;
  phaseTransitions.add(groupId);
  logPhaseTransition(groupId, "vote-resolution", trigger);
  let resolved = false;
  try {
    const result = sessions.resolveVote(groupId, trigger === "timer");
    clearPhaseTimer(groupId);
    const view = sessions.gameSnapshot(groupId);
    await safeSend(socket, groupId, result.eliminatedPlayerId ? `⚖️ VOTE RESOLVED\n\n${deceasedLabel(view, result.eliminatedPlayerId)} has been eliminated.` : "⚖️ VOTE RESOLVED\n\nNo player was eliminated by the vote.");
    resolved = true;
  } catch (error) {
    await safeSend(socket, groupId, error instanceof GameError ? error.message : "Voting could not be resolved.");
  } finally { phaseTransitions.delete(groupId); }
  if (resolved) await continueGame(socket, groupId);
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
