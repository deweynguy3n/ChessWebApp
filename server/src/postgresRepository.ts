import pg from "pg";
import type { GameResult, GameStatus, MoveSummary, Seat } from "@chesswebapp/shared";
import type { CreateGameInput, GameRecord, GameRepository, JoinGameInput, PersistMoveInput, StoredGame, StoredPlayer } from "./repository.js";

const { Pool } = pg;

interface DbGameRow {
  id: string;
  status: GameStatus;
  fen: string;
  pgn: string;
  turn: Seat;
  result: GameResult;
  created_at: Date;
  updated_at: Date;
}

interface DbPlayerRow {
  id: string;
  game_id: string;
  seat: Seat;
  display_name: string;
  token_hash: string;
  joined_at: Date;
}

interface DbMoveRow {
  id: string;
  move_number: number;
  color: Seat;
  from_square: string;
  to_square: string;
  promotion: MoveSummary["promotion"];
  san: string;
  fen_after: string;
  created_at: Date;
}

export class PostgresGameRepository implements GameRepository {
  readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async createGame(input: CreateGameInput): Promise<GameRecord> {
    await this.pool.query("BEGIN");
    try {
      await this.pool.query(
        `INSERT INTO games (id, status, fen, pgn, turn, result, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          input.game.id,
          input.game.status,
          input.game.fen,
          input.game.pgn,
          input.game.turn,
          input.game.result,
          input.game.createdAt,
          input.game.updatedAt
        ]
      );
      await this.insertPlayer(input.player);
      await this.pool.query("COMMIT");
      return this.mustGetGame(input.game.id);
    } catch (error) {
      await this.pool.query("ROLLBACK");
      throw error;
    }
  }

  async getGame(gameId: string): Promise<GameRecord | null> {
    return this.getGameRecord(gameId);
  }

  async joinGame(input: JoinGameInput): Promise<GameRecord> {
    await this.pool.query("BEGIN");
    try {
      await this.insertPlayer(input.player);
      await this.pool.query("UPDATE games SET status = $1, updated_at = now() WHERE id = $2", [input.status, input.gameId]);
      await this.pool.query("COMMIT");
      return this.mustGetGame(input.gameId);
    } catch (error) {
      await this.pool.query("ROLLBACK");
      throw error;
    }
  }

  async persistMove(input: PersistMoveInput): Promise<GameRecord> {
    await this.pool.query("BEGIN");
    try {
      await this.pool.query(
        `INSERT INTO moves (id, game_id, move_number, color, from_square, to_square, promotion, san, fen_after, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          input.move.id,
          input.gameId,
          input.move.moveNumber,
          input.move.color,
          input.move.from,
          input.move.to,
          input.move.promotion,
          input.move.san,
          input.move.fenAfter,
          input.move.createdAt
        ]
      );
      await this.pool.query(
        "UPDATE games SET fen = $1, pgn = $2, turn = $3, status = $4, result = $5, updated_at = now() WHERE id = $6",
        [input.fen, input.pgn, input.turn, input.status, input.result, input.gameId]
      );
      await this.pool.query("COMMIT");
      return this.mustGetGame(input.gameId);
    } catch (error) {
      await this.pool.query("ROLLBACK");
      throw error;
    }
  }

  async resignGame(gameId: string, status: GameStatus, result: GameResult): Promise<GameRecord> {
    await this.pool.query("UPDATE games SET status = $1, result = $2, updated_at = now() WHERE id = $3", [status, result, gameId]);
    return this.mustGetGame(gameId);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async insertPlayer(player: StoredPlayer): Promise<void> {
    await this.pool.query(
      `INSERT INTO players (id, game_id, seat, display_name, token_hash, joined_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [player.id, player.gameId, player.seat, player.displayName, player.tokenHash, player.joinedAt]
    );
  }

  private async mustGetGame(gameId: string): Promise<GameRecord> {
    const record = await this.getGameRecord(gameId);
    if (!record) {
      throw new Error("Game not found.");
    }
    return record;
  }

  private async getGameRecord(gameId: string): Promise<GameRecord | null> {
    const gameResult = await this.pool.query<DbGameRow>("SELECT * FROM games WHERE id = $1", [gameId]);
    const gameRow = gameResult.rows[0];
    if (!gameRow) {
      return null;
    }

    const playersResult = await this.pool.query<DbPlayerRow>("SELECT * FROM players WHERE game_id = $1 ORDER BY joined_at", [gameId]);
    const movesResult = await this.pool.query<DbMoveRow>("SELECT * FROM moves WHERE game_id = $1 ORDER BY move_number, color", [gameId]);

    return {
      game: toGame(gameRow),
      players: playersResult.rows.map(toPlayer),
      moves: movesResult.rows.map(toMove)
    };
  }
}

function toGame(row: DbGameRow): StoredGame {
  return {
    id: row.id,
    status: row.status,
    fen: row.fen,
    pgn: row.pgn,
    turn: row.turn,
    result: row.result,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toPlayer(row: DbPlayerRow): StoredPlayer {
  return {
    id: row.id,
    gameId: row.game_id,
    seat: row.seat,
    displayName: row.display_name,
    tokenHash: row.token_hash,
    joinedAt: row.joined_at.toISOString()
  };
}

function toMove(row: DbMoveRow): MoveSummary {
  return {
    id: row.id,
    moveNumber: row.move_number,
    color: row.color,
    from: row.from_square,
    to: row.to_square,
    promotion: row.promotion,
    san: row.san,
    fenAfter: row.fen_after,
    createdAt: row.created_at.toISOString()
  };
}
