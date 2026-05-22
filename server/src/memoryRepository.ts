import type { GameRecord, GameRepository, JoinGameInput, PersistMoveInput, CreateGameInput } from "./repository.js";

export class InMemoryGameRepository implements GameRepository {
  private records = new Map<string, GameRecord>();

  async createGame(input: CreateGameInput): Promise<GameRecord> {
    const record: GameRecord = {
      game: input.game,
      players: [input.player],
      moves: []
    };
    this.records.set(input.game.id, record);
    return structuredClone(record);
  }

  async getGame(gameId: string): Promise<GameRecord | null> {
    const record = this.records.get(gameId);
    return record ? structuredClone(record) : null;
  }

  async joinGame(input: JoinGameInput): Promise<GameRecord> {
    const record = this.mustGet(input.gameId);
    if (record.players.some((player) => player.seat === input.player.seat)) {
      throw new Error("Seat is already taken.");
    }
    record.players.push(input.player);
    record.game.status = input.status;
    record.game.updatedAt = new Date().toISOString();
    return structuredClone(record);
  }

  async persistMove(input: PersistMoveInput): Promise<GameRecord> {
    const record = this.mustGet(input.gameId);
    record.moves.push(input.move);
    record.game.fen = input.fen;
    record.game.pgn = input.pgn;
    record.game.turn = input.turn;
    record.game.status = input.status;
    record.game.result = input.result;
    record.game.updatedAt = new Date().toISOString();
    return structuredClone(record);
  }

  async resignGame(gameId: string, status: "resigned", result: "1-0" | "0-1"): Promise<GameRecord> {
    const record = this.mustGet(gameId);
    record.game.status = status;
    record.game.result = result;
    record.game.updatedAt = new Date().toISOString();
    return structuredClone(record);
  }

  private mustGet(gameId: string): GameRecord {
    const record = this.records.get(gameId);
    if (!record) {
      throw new Error("Game not found.");
    }
    return record;
  }
}
