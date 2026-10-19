import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export interface PlayerStats {
  id: string;
  games: number;
  wins: number;
  lynched: number;
  survived: number;
  roles: Record<string, number>;
}

interface StoreData {
  players: Record<string, PlayerStats>;
  chronicle: string[];
}

export class StatsStore {
  private data: StoreData;
  private readonly filePath: string;

  constructor(filePath = "./.data/lordxeno-stats.json") {
    this.filePath = filePath;
    mkdirSync(filePath.slice(0, filePath.lastIndexOf("/")), { recursive: true });
    this.data = existsSync(filePath) ? JSON.parse(readFileSync(filePath, "utf8")) as StoreData : { players: {}, chronicle: [] };
  }

  get(playerId: string): PlayerStats {
    return this.data.players[playerId] ?? { id: playerId, games: 0, wins: 0, lynched: 0, survived: 0, roles: {} };
  }

  leaderboard(limit = 10): PlayerStats[] {
    return Object.values(this.data.players).sort((left, right) => right.wins - left.wins || right.survived - left.survived).slice(0, limit);
  }

  chronicle(limit = 10): string[] { return this.data.chronicle.slice(-limit).reverse(); }

  record(playerId: string, role: string, won: boolean, lynched: boolean, survived: boolean): void {
    const current = this.get(playerId);
    current.games += 1;
    current.wins += won ? 1 : 0;
    current.lynched += lynched ? 1 : 0;
    current.survived += survived ? 1 : 0;
    current.roles[role] = (current.roles[role] ?? 0) + 1;
    this.data.players[playerId] = current;
    this.persist();
  }

  addChronicle(entry: string): void {
    this.data.chronicle.push(entry);
    this.data.chronicle = this.data.chronicle.slice(-100);
    this.persist();
  }

  private persist(): void {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
}
