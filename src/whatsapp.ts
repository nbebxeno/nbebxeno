import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import * as qrcodeImage from "qrcode";
import { GameError } from "./engine.ts";
import { PermanentGms, canonicalIdentity, matchingParticipant, metadataIsAdmin } from "./access.ts";
import { GameSessions } from "./session.ts";
import { discussionStory, nightStory, votingStory, dawnStory, verdictStory } from "./narration.ts";
import { replayCard, replayHighlights } from "./replay.ts";
import { leaderboardPng, leaderboardName } from "./leaderboard-image.ts";
import { StatsStore } from "./stats.ts";
import { helpText, resolveCommand, normalizeCommand } from "./commands.ts";
import { roleCard, lobbyCard, rosterCard, statusCard, rolesCard, roleLabel, deceasedLabel, victoryCard, votingCard, phaseBanner } from "./presentation.ts";

const authDirectory = "./.auth/lordxeno";
const qrImagePath = `${authDirectory}/whatsapp-qr.png`;
const sessions = new GameSessions({ tieRule: "no-elimination", revealRoleOnDeath: true }, "./.data/lordxeno-games.json");
const phaseTransitions = new Set<string>();
const phaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
const duplicateJoinWarnings = new Set<string>();
const commandCooldowns = new Map<string, number>();
const stats = new StatsStore();
const permanentGms = new PermanentGms();
let activeSocket: ReturnType<typeof makeWASocket> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function messageText(message: { conversation?: string | null; extendedTextMessage?: { text?: string | null } | null }): string {
  return message.conversation ?? message.extendedTextMessage?.text ?? "";
}

function lobbyMessage(snapshot: ReturnType<GameSessions["snapshot"]>): string {
  return lobbyCard(snapshot, sessions.mode(snapshot.groupId));
}

function rosterMessage(groupId: string): string {
  return rosterCard(sessions.gameSnapshot(groupId));
}

function isActiveGame(groupId: string): boolean {
  try { return sessions.gameSnapshot(groupId).status === "active"; }
  catch { return false; }
}

function schedulePhaseTimer(groupId: string, milliseconds: number, callback: () => void, nextPhase?: "night" | "voting"): void {
  if (!isActiveGame(groupId)) return;
  const previous = phaseTimers.get(groupId);
  if (previous) clearTimeout(previous);
  sessions.setPhaseDeadline(groupId, Date.now() + milliseconds, nextPhase);
  phaseTimers.set(groupId, setTimeout(() => {
    phaseTimers.delete(groupId);
    callback();
  }, milliseconds));
}

function clearPhaseTimer(groupId: string): void {
  const timer = phaseTimers.get(groupId);
  if (timer) clearTimeout(timer);
  phaseTimers.delete(groupId);
  try { sessions.setPhaseDeadline(groupId, undefined); } catch { /* session may already be gone */ }
}

function logPhaseTransition(groupId: string, phase: string, trigger: string): void {
  console.log(`[phase] ${new Date().toISOString()} group=${groupId} phase=${phase} trigger=${trigger}`);
}

function remainingSeconds(groupId: string): number | null {
  const deadline = sessions.phaseDeadline(groupId);
  return deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : null;
}

function recordCompletedGame(groupId: string): void {
  const result = sessions.completedRecord(groupId);
  if (!result) return;
  for (const player of result.players) stats.record(player.id, player.role, (result.winner !== "neutral" && player.faction === result.winner) || result.individualWinners.includes(player.id), player.lynched, player.alive, player.displayName);
  stats.addChronicle(`${new Date().toISOString().slice(0, 10)}: ${result.winner} victory in ${groupId}; ${result.players.length} players summoned.`);
}

async function managerAccess(socket: ReturnType<typeof makeWASocket>, groupId: string | undefined, identities: Array<string | null | undefined>, fromMe = false): Promise<"gm" | "admin" | null> {
  if (fromMe) return "gm"; // This flag is supplied by the linked WhatsApp session.
  if (permanentGms.has(identities)) return "gm";
  const resolved = [...identities];
  for (const identity of identities) {
    const canonical = canonicalIdentity(identity);
    if (!canonical) continue;
    try {
      const mappings = socket.signalRepository?.lidMapping;
      const alternate = canonical.endsWith("@lid") ? await mappings?.getPNForLID(canonical) : await mappings?.getLIDForPN(canonical);
      if (alternate) resolved.push(alternate);
    } catch { /* Metadata may still provide the verified alternate identity. */ }
  }
  if (permanentGms.has(resolved)) return "gm";
  if (!groupId) {
    // Some private messages contain only a LID. Resolve it through verified
    // membership metadata when the session's LID cache is not populated yet.
    if (resolved.some((identity) => canonicalIdentity(identity)?.endsWith("@lid"))) {
      for (const game of sessions.manageableGames()) {
        try {
          const metadata = await socket.groupMetadata(game.groupId);
          const participant = matchingParticipant(metadata, resolved);
          if (participant && permanentGms.has([participant.id, participant.phoneNumber, participant.lid])) return "gm";
        } catch { /* One unavailable group must not block the remaining checks. */ }
      }
    }
    return null;
  }
  const metadata = await socket.groupMetadata(groupId);
  const participant = matchingParticipant(metadata, resolved);
  if (participant && permanentGms.has([participant.id, participant.phoneNumber, participant.lid])) return "gm";
  return metadataIsAdmin(metadata, resolved) ? "admin" : null;
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
      if (!message.message || !message.key.remoteJid) continue;
      const remoteJid = message.key.remoteJid;
      const text = messageText(message.message).trim();
      const command = normalizeCommand(text);
      const commandName = resolveCommand(command)?.name;
      if (!commandName || (message.key.fromMe && !["endgame", "kick", "gm", "games"].includes(commandName))) continue;
      const commandKey = `${message.key.remoteJid}:${participantIdentity(message)}:${command}`;
      const lastCommand = commandCooldowns.get(commandKey) ?? 0;
      if (Date.now() - lastCommand < 750) continue;
      commandCooldowns.set(commandKey, Date.now());
      if (commandName === "ping") {
        await safeSend(socket, message.key.remoteJid, "lordxeno transport online.");
        continue;
      }
      if (commandName === "help") {
        await safeSend(socket, message.key.remoteJid, helpText(command.slice("!xeno help".length).trim()));
        continue;
      }
      const participantAlias = message.key.participant === participantIdentity(message) ? message.key.participantAlt : message.key.participant;
      const joinWarningKey = `${remoteJid}:${participantIdentity(message)}`;
      const groupIdentity = message.key.fromMe ? socket.user?.id ?? participantIdentity(message) : participantIdentity(message);
      const senderIdentities = [groupIdentity, message.key.participant, message.key.participantAlt, (message.key as { participantPn?: string }).participantPn];
      const sender = { id: groupIdentity, displayName: message.pushName ?? groupIdentity };
      try {
        if (commandName === "lastwords") {
          if (remoteJid.endsWith("@g.us")) throw new GameError("Send your last words in DM: !lastwords <message>.");
          let identity = remoteJid, groupId: string;
          try { groupId = sessions.lastWordsGroup(identity); }
          catch (error) { if (!message.key.remoteJidAlt) throw error; identity = message.key.remoteJidAlt; groupId = sessions.lastWordsGroup(identity); }
          const words = text.replace(/^!(?:xeno\s+)?lastwords\s*/i, "");
          for (const event of sessions.lastWords(groupId, identity, words)) await safeSend(socket, event.recipient ?? groupId, event.text);
          await safeSend(socket, remoteJid, "Your last words have reached the square. Rest dramatically.");
          continue;
        }
        if (!remoteJid.endsWith("@g.us") && ["gm", "games", "endgame"].includes(commandName)) {
          const privateIdentities = [remoteJid, message.key.remoteJidAlt];
          const permanent = await managerAccess(socket, undefined, privateIdentities, message.key.fromMe ?? false) === "gm";
          const games = sessions.manageableGames();
          if (commandName === "gm") {
            await safeSend(socket, remoteJid, permanent ? "🎮 Permanent Game Master access: yes. Use !games or !endgame here in DM." : "Permanent Game Master access: no. Configure your number locally with the gm setup command.");
          } else if (commandName === "games") {
            if (!permanent) throw new GameError("Only a permanent Game Master can list all games.");
            await safeSend(socket, remoteJid, games.length ? ["🎮 *GM · ACTIVE GAMES*", "", ...games.map((game) => `${game.host}'s game · ${game.phase} · ${game.players} players\n!endgame ${game.code}`)].join("\n") : "No active games or lobbies.");
          } else {
            const code = command.slice("!xeno endgame".length).trim();
            let target = code ? games.find((game) => game.code === code) : undefined;
            if (!code) {
              try { const groupId = locatePrivateGame(remoteJid, message.key.remoteJidAlt); target = games.find((game) => game.groupId === groupId); }
              catch { if (permanent && games.length === 1) target = games[0]; }
            }
            if (!target) throw new GameError(permanent ? "Use !games, then !endgame <game-code> to choose a running game or lobby." : "Send !endgame in your group or specify its game code.");
            if (!permanent && !await managerAccess(socket, target.groupId, privateIdentities, message.key.fromMe ?? false)) throw new GameError("Only a group admin or permanent Game Master can end this game.");
            await stopGame(socket, target.groupId, message.pushName ?? "Game Master");
            await safeSend(socket, remoteJid, "🛑 Game ended. The group has been notified.");
          }
          continue;
        }
        if (!remoteJid.endsWith("@g.us") && ["actions", "act", "skip", "myrole", "details"].includes(commandName)) {
          const actionGroupId = locatePrivateGame(remoteJid, message.key.remoteJidAlt);
          if (commandName === "actions") {
            await safeSend(socket, remoteJid, sessions.actionPrompt(actionGroupId, remoteJid));
          } else if (["myrole", "details"].includes(commandName)) {
            await safeSend(socket, remoteJid, roleCard(sessions.privateView(actionGroupId, sessions.resolvePlayerId(actionGroupId, remoteJid)), commandName === "details"));
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
        if (commandName === "games") {
          throw new GameError("Use !games in DM for private Game Master control.");
        } else if (commandName === "gm") {
          const access = await managerAccess(socket, remoteJid, senderIdentities, message.key.fromMe ?? false);
          await safeSend(socket, remoteJid, access === "gm" ? "🎮 Permanent Game Master access: yes. You can use !endgame and !kick without being a group admin." : access === "admin" ? "You have group-admin access. Permanent Game Master access: no." : "You do not have Game Master or group-admin access.");
        } else if (commandName === "lobby") {
          clearPhaseTimer(remoteJid);
          await safeSend(socket, message.key.remoteJid, lobbyMessage(sessions.createLobby(message.key.remoteJid, sender)));
          stats.rememberName(sender.id, sender.displayName);
          if (participantAlias && participantAlias !== groupIdentity) sessions.registerAlias(remoteJid, groupIdentity, participantAlias);
        } else if (commandName === "mode") {
          const mode = command.slice("!xeno mode ".length).trim();
          if (mode !== "classic" && mode !== "beginner" && mode !== "chaos") throw new GameError("Choose classic, beginner, or chaos.");
          sessions.setMode(remoteJid, groupIdentity, mode);
          await safeSend(socket, remoteJid, lobbyMessage(sessions.snapshot(remoteJid)));
        } else if (commandName === "join") {
          if (!sessions.mode(remoteJid)) throw new GameError("The host must choose a game mode before players join.");
          const lobby = sessions.joinLobby(remoteJid, sender);
          stats.rememberName(sender.id, sender.displayName);
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
          for (const view of started.privateViews) await safeSend(socket, view.player.id, roleCard(view));
          void enterPhase(socket, remoteJid, "discussion", phaseBanner("DAY 1 / THE SQUARE", "Discussion · 2 minutes", discussionStory(1, `${remoteJid}:${sessions.gameSnapshot(remoteJid).startedAt}`)), "night");
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
        } else if (["myrole", "details"].includes(commandName)) {
          const view = sessions.privateView(remoteJid, groupIdentity);
          await safeSend(socket, groupIdentity, roleCard(view, commandName === "details"));
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
        } else if (commandName === "replay") {
          const page = command.slice("!xeno replay".length).trim();
          await safeSend(socket, remoteJid, replayCard(sessions.replay(remoteJid), page ? Number(page) : 1));
        } else if (commandName === "leaderboard") {
          const top = stats.leaderboard();
          try {
            await socket.sendMessage(remoteJid, { image: await leaderboardPng(top), caption: "LORDXENO / HALL OF FAME\nThe village remembers its legends. · !stats" });
          } catch {
            const entries = top.map((entry, i) => `${i + 1}. ${leaderboardName(entry, i + 1)} · ${entry.wins} wins · ${entry.games} games`).join("\n");
            await safeSend(socket, remoteJid, `*LORDXENO / HALL OF FAME*\n────────────────\n${entries || "No legends yet. Finish a game to claim your place."}`);
          }
        } else if (commandName === "kick") {
          if (!await managerAccess(socket, remoteJid, senderIdentities, message.key.fromMe ?? false)) throw new GameError("Only a group admin or permanent Game Master can kick players.");
          const targetNumber = Number(command.slice("!xeno kick ".length).trim());
          if (!Number.isInteger(targetNumber)) throw new GameError("Kick a lobby player by number.");
          const lobby = sessions.snapshot(remoteJid);
          const target = lobby.players[targetNumber - 1];
          if (!target) throw new GameError("That lobby player number does not exist.");
          sessions.kick(remoteJid, groupIdentity, target.id, true);
          await safeSend(socket, remoteJid, `${target.displayName} was removed from the lobby.`);
        } else if (commandName === "endgame") {
          if (!await managerAccess(socket, remoteJid, senderIdentities, message.key.fromMe ?? false)) throw new GameError("Only a group admin or permanent Game Master can end the game. Use !gm to check your access.");
          if (command !== "!xeno endgame") throw new GameError("In a group, use !endgame without a code. Use game codes only in DM.");
          await stopGame(socket, remoteJid, sender.displayName);
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

async function stopGame(socket: ReturnType<typeof makeWASocket>, groupId: string, actorName: string): Promise<void> {
  sessions.endGame(groupId);
  clearPhaseTimer(groupId);
  const reopened = await setDiscussionAccess(socket, groupId);
  await safeSend(socket, groupId, `🛑 Game ended by ${actorName}. ${reopened ? "Group chat is open." : "I could not reopen group chat; a group admin needs to open it manually."}`);
}

async function flushEvents(socket: ReturnType<typeof makeWASocket>, groupId: string): Promise<void> {
  for (const event of sessions.drainEvents(groupId)) await safeSend(socket, event.recipient ?? groupId, event.text);
}

async function continueGame(socket: ReturnType<typeof makeWASocket>, groupId: string, message?: string): Promise<void> {
  await flushEvents(socket, groupId);
  const view = sessions.gameSnapshot(groupId);
  if (view.status === "ended") {
    clearPhaseTimer(groupId);
    await setDiscussionAccess(socket, groupId);
    if (message) await safeSend(socket, groupId, message);
    await safeSend(socket, groupId, victoryCard(sessions.victorySummary(groupId)));
    recordCompletedGame(groupId);
    await safeSend(socket, groupId, replayHighlights(sessions.replay(groupId)));
    return;
  }
  if (view.phase === "reaction") {
    if (message) await safeSend(socket, groupId, message);
    await enterReaction(socket, groupId);
  } else if (view.phase === "discussion") {
    const seconds = sessions.discussionMilliseconds(groupId) / 1000;
    await enterPhase(socket, groupId, "discussion", `${message ? `${message}\n\n` : ""}${phaseBanner(`DAY ${view.dayNumber} / THE SQUARE`, `Discussion · ${seconds}s`, discussionStory(view.dayNumber, `${groupId}:${view.startedAt}`))}`, "voting");
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
        await setDiscussionAccess(socket, groupId);
        await safeSend(socket, groupId, victoryCard(sessions.victorySummary(groupId)));
        await flushEvents(socket, groupId); recordCompletedGame(groupId); return;
      }
      const actual = current.phase;
      if (actual !== "night" && actual !== "voting") throw new GameError("This phase cannot begin now.");
      await setNightAccess(socket, groupId);
      await flushEvents(socket, groupId);
      await safeSend(socket, groupId, actual === "night" ? phaseBanner(`NIGHT ${current.nightNumber} / LIGHTS OUT`, "60s · Powers in DM · !actions", nightStory(current.nightNumber, `${groupId}:${current.startedAt}`)) : phaseBanner("THE VERDICT", "60s · Vote privately", votingStory(current.dayNumber, `${groupId}:${current.startedAt}`)));
      const actors = sessions.actionActors(groupId);
      for (const player of current.players.filter((player) => player.alive)) {
        if (actual === "voting") await safeSend(socket, player.id, votingCard(sessions.gameSnapshot(groupId)));
        if (actors.includes(player.id)) await safeSend(socket, player.id, `${sessions.actionPrompt(groupId, player.id)}\n\n⏱ 60s`);
        else if (actual === "night") await safeSend(socket, player.id, "🌑 *NIGHT* · Rest until dawn.\nYour passive effects apply automatically.");
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
    const deaths = result.deaths.map((id) => ({ ...view.deaths.find((death) => death.playerId === id)!, displayName: view.players.find((player) => player.id === id)?.displayName ?? id }));
    dawn = phaseBanner("DAWN / THE RECKONING", `Day ${view.dayNumber}`, dawnStory(view.dayNumber, deaths, `${groupId}:${view.startedAt}`));
    if (deaths.length) dawn += `\n\n${result.deaths.map((id) => deceasedLabel(view, id)).join("\n")}`;
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
    await safeSend(socket, groupId, verdictStory(result.eliminatedPlayerId ? view.players.find((player) => player.id === result.eliminatedPlayerId)?.displayName ?? null : null));
    resolved = true;
  } catch (error) {
    await safeSend(socket, groupId, error instanceof GameError ? error.message : "Voting could not be resolved.");
  } finally { phaseTransitions.delete(groupId); }
  if (resolved) await continueGame(socket, groupId);
}

async function setNightAccess(socket: ReturnType<typeof makeWASocket>, groupId: string): Promise<void> {
  try {
    if (!isActiveGame(groupId)) return;
    await socket.groupSettingUpdate(groupId, "announcement");
    if (!isActiveGame(groupId)) await setDiscussionAccess(socket, groupId);
  } catch (error) {
    console.error(`Could not lock ${groupId}; the bot may not be a group admin.`, error instanceof Error ? error.message : error);
  }
}

async function setDiscussionAccess(socket: ReturnType<typeof makeWASocket>, groupId: string): Promise<boolean> {
  try {
    await socket.groupSettingUpdate(groupId, "not_announcement");
    return true;
  } catch (error) {
    console.error(`Could not open ${groupId}; the bot may not be a group admin.`, error instanceof Error ? error.message : error);
    return false;
  }
}

void startWhatsApp();
