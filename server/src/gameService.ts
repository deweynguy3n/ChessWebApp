import { Chess } from "chess.js";
import type {
  CapturedPieces,
  CreateGameResponse,
  GameResult,
  GameSnapshot,
  GameStatus,
  JoinGameResponse,
  MoveSummary,
  PromotionPiece,
  Seat
} from "@chesswebapp/shared";
import { createId, createPlayerToken, hashToken } from "./ids.js";
import type { GameRecord, GameRepository, StoredPlayer } from "./repository.js";

const FINISHED_STATUSES = new Set<GameStatus>(["checkmate", "stalemate", "draw", "resigned"]);

export interface MoveResult {
  snapshot: GameSnapshot;
  move: MoveSummary;
}

export class GameService {
  constructor(private readonly repository: GameRepository) {}

  async createGame(displayName: string): Promise<CreateGameResponse> {
    const now = new Date().toISOString();
    const chess = new Chess();
    const gameId = createId("game");
    const token = createPlayerToken();
    const record = await this.repository.createGame({
      game: {
        id: gameId,
        status: "waiting",
        fen: chess.fen(),
        pgn: chess.pgn(),
        turn: "white",
        result: null,
        createdAt: now,
        updatedAt: now
      },
      player: createPlayer(gameId, "white", displayName, token, now)
    });

    return {
      gameId,
      seat: "white",
      playerToken: token,
      snapshot: toSnapshot(record)
    };
  }

  async joinGame(gameId: string, displayName: string): Promise<JoinGameResponse> {
    const record = await this.getRequiredRecord(gameId);
    if (record.players.some((player) => player.seat === "black")) {
      throw new ClientError(409, "Black seat is already taken.");
    }
    if (FINISHED_STATUSES.has(record.game.status)) {
      throw new ClientError(409, "This game is already finished.");
    }

    const token = createPlayerToken();
    const joined = await this.repository.joinGame({
      gameId,
      status: "active",
      player: createPlayer(gameId, "black", displayName, token, new Date().toISOString())
    });

    return {
      gameId,
      seat: "black",
      playerToken: token,
      snapshot: toSnapshot(joined)
    };
  }

  async getSnapshot(gameId: string, connectedSeats = new Set<Seat>()): Promise<GameSnapshot> {
    const record = await this.getRequiredRecord(gameId);
    return toSnapshot(record, connectedSeats);
  }

  async getSeatForToken(gameId: string, token?: string): Promise<Seat | "spectator"> {
    if (!token) {
      return "spectator";
    }
    const record = await this.getRequiredRecord(gameId);
    const tokenHash = hashToken(token);
    const player = record.players.find((candidate) => candidate.tokenHash === tokenHash);
    return player?.seat ?? "spectator";
  }

  async submitMove(gameId: string, token: string | undefined, from: string, to: string, promotion?: PromotionPiece): Promise<MoveResult> {
    const record = await this.getRequiredRecord(gameId);
    const seat = await this.getSeatForToken(gameId, token);
    if (seat === "spectator") {
      throw new ClientError(403, "Spectators cannot move pieces.");
    }
    if (record.game.status !== "active") {
      throw new ClientError(409, "This game is not active.");
    }
    if (record.players.length < 2) {
      throw new ClientError(409, "Waiting for Black to join.");
    }
    if (record.game.turn !== seat) {
      throw new ClientError(409, "It is not your turn.");
    }

    const chess = new Chess(record.game.fen);
    const move = chess.move({ from, to, promotion });
    if (!move) {
      throw new ClientError(400, "That move is not legal.");
    }

    const status = getStatus(chess);
    const result = getResult(chess, status, seat);
    const summary: MoveSummary = {
      id: createId("move"),
      moveNumber: Math.floor(record.moves.length / 2) + 1,
      color: seat,
      from,
      to,
      promotion: promotion ?? null,
      san: move.san,
      fenAfter: chess.fen(),
      createdAt: new Date().toISOString()
    };

    const updated = await this.repository.persistMove({
      gameId,
      move: summary,
      fen: chess.fen(),
      pgn: chess.pgn(),
      turn: chess.turn() === "w" ? "white" : "black",
      status,
      result
    });

    return { snapshot: toSnapshot(updated), move: summary };
  }

  async resign(gameId: string, token?: string): Promise<GameSnapshot> {
    const record = await this.getRequiredRecord(gameId);
    const seat = await this.getSeatForToken(gameId, token);
    if (seat === "spectator") {
      throw new ClientError(403, "Spectators cannot resign this game.");
    }
    if (FINISHED_STATUSES.has(record.game.status)) {
      throw new ClientError(409, "This game is already finished.");
    }
    const result: GameResult = seat === "white" ? "0-1" : "1-0";
    const updated = await this.repository.resignGame(gameId, "resigned", result);
    return toSnapshot(updated);
  }

  private async getRequiredRecord(gameId: string): Promise<GameRecord> {
    const record = await this.repository.getGame(gameId);
    if (!record) {
      throw new ClientError(404, "Game not found.");
    }
    return record;
  }
}

export class ClientError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

function createPlayer(gameId: string, seat: Seat, displayName: string, token: string, now: string): StoredPlayer {
  return {
    id: createId("player"),
    gameId,
    seat,
    displayName: cleanDisplayName(displayName),
    tokenHash: hashToken(token),
    joinedAt: now
  };
}

function cleanDisplayName(displayName: string): string {
  const cleaned = displayName.trim().replace(/\s+/g, " ");
  if (cleaned.length < 1) {
    throw new ClientError(400, "Display name is required.");
  }
  if (cleaned.length > 32) {
    throw new ClientError(400, "Display name must be 32 characters or fewer.");
  }
  return cleaned;
}

function getStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) return "checkmate";
  if (chess.isStalemate()) return "stalemate";
  if (chess.isDraw()) return "draw";
  return "active";
}

function getResult(chess: Chess, status: GameStatus, mover: Seat): GameResult {
  if (status === "checkmate") {
    return mover === "white" ? "1-0" : "0-1";
  }
  if (status === "stalemate" || status === "draw") {
    return "1/2-1/2";
  }
  return null;
}

function toSnapshot(record: GameRecord, connectedSeats = new Set<Seat>()): GameSnapshot {
  return {
    id: record.game.id,
    status: record.game.status,
    fen: record.game.fen,
    pgn: record.game.pgn,
    turn: record.game.turn,
    result: record.game.result,
    players: record.players.map((player) => ({
      seat: player.seat,
      displayName: player.displayName,
      connected: connectedSeats.has(player.seat)
    })),
    moves: record.moves,
    captured: getCapturedPieces(record.game.fen),
    createdAt: record.game.createdAt,
    updatedAt: record.game.updatedAt
  };
}

function getCapturedPieces(fen: string): CapturedPieces {
  const chess = new Chess(fen);
  const counts = new Map<string, number>();
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece) {
        const key = piece.color + piece.type;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  return {
    white: missingPieces("w", counts),
    black: missingPieces("b", counts)
  };
}

function missingPieces(color: "w" | "b", counts: Map<string, number>): string[] {
  const expected = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  return Object.entries(expected).flatMap(([piece, total]) => {
    const missing = total - (counts.get(color + piece) ?? 0);
    return Array.from({ length: Math.max(0, missing) }, () => piece);
  });
}
