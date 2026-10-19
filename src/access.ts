import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Never compare the digits of a LID with a phone number: they are namespaces. */
export function canonicalIdentity(identity?: string | null): string | undefined {
  if (!identity) return undefined;
  const value = identity.trim();
  if (!value.includes("@")) {
    const digits = value.replace(/[+\s()-]/g, "");
    return /^\d+$/.test(digits) ? `${digits}@s.whatsapp.net` : undefined;
  }
  const parts = value.toLowerCase().split("@");
  if (parts.length !== 2) return undefined;
  const [local, server] = parts;
  if (!local || !["s.whatsapp.net", "c.us", "lid"].includes(server)) return undefined;
  return `${local.replace(/:\d+$/, "")}@${server === "c.us" ? "s.whatsapp.net" : server}`;
}

export interface ParticipantIdentity { id: string; phoneNumber?: string; lid?: string; admin?: string | null; isAdmin?: boolean; isSuperAdmin?: boolean; }
export interface AdminMetadata { owner?: string; ownerPn?: string; participants: ParticipantIdentity[]; }
export function identitiesMatch(left: Array<string | null | undefined>, right: Array<string | null | undefined>): boolean {
  const first = new Set(left.map(canonicalIdentity).filter(Boolean));
  return right.some((identity) => { const canonical = canonicalIdentity(identity); return !!canonical && first.has(canonical); });
}
export function matchingParticipant(metadata: AdminMetadata, identities: Array<string | null | undefined>): ParticipantIdentity | undefined {
  return metadata.participants.find((participant) => identitiesMatch(identities, [participant.id, participant.phoneNumber, participant.lid]));
}
export function metadataIsAdmin(metadata: AdminMetadata, identities: Array<string | null | undefined>): boolean {
  if (identitiesMatch(identities, [metadata.owner, metadata.ownerPn])) return true;
  return metadata.participants.some((participant) => identitiesMatch(identities, [participant.id, participant.phoneNumber, participant.lid]) && (participant.admin === "admin" || participant.admin === "superadmin" || participant.isAdmin === true || participant.isSuperAdmin === true));
}

export class PermanentGms {
  private filePath: string;
  constructor(filePath = "./.data/lordxeno-access.json") { this.filePath = filePath; }
  list(): string[] {
    if (!existsSync(this.filePath)) return [];
    const data = JSON.parse(readFileSync(this.filePath, "utf8")) as { gameMasters?: unknown };
    if (!Array.isArray(data.gameMasters) || data.gameMasters.some((id) => typeof id !== "string" || !canonicalIdentity(id))) throw new Error("Invalid local Game Master configuration. Use npm run gm -- add <number> to configure access.");
    return [...new Set(data.gameMasters.map((id: string) => canonicalIdentity(id)!))];
  }
  has(identities: Array<string | null | undefined>): boolean { return identitiesMatch(this.list(), identities); }
  add(phone: string): void {
    const digits = phone.trim().replace(/[+\s()-]/g, "");
    if (!/^[1-9]\d{6,14}$/.test(digits)) throw new Error("Use a full international phone number, including country code.");
    this.save([...new Set([...this.list(), `${digits}@s.whatsapp.net`])]);
  }
  remove(phone: string): void { const id = canonicalIdentity(phone); if (!id) throw new Error("Invalid phone number."); this.save(this.list().filter((entry) => entry !== id)); }
  private save(gameMasters: string[]): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify({ gameMasters }, null, 2) + "\n", { mode: 0o600 });
  }
}
