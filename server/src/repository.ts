import type { GameResult, GameStatus, MoveSummary, Seat } from "@chesswebapp/shared";

export interface StoredGame {
  id: string;
  status: GameStatus;
  fen: string;
  pgn: string;
  turn: Seat;
  result: GameResult;
  timeControlSeconds: number | null;
  whiteMsRemaining: number | null;
  blackMsRemaining: number | null;
  turnStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredPlayer {
  id: string;
  gameId: string;
  seat: Seat;
  displayName: string;
  tokenHash: string;
  joinedAt: string;
}

export interface GameRecord {
  game: StoredGame;
  players: StoredPlayer[];
  moves: MoveSummary[];
}

export interface CreateGameInput {
  game: StoredGame;
  player: StoredPlayer;
}

export interface JoinGameInput {
  gameId: string;
  player: StoredPlayer;
  status: GameStatus;
}

export interface PersistMoveInput {
  gameId: string;
  move: MoveSummary;
  fen: string;
  pgn: string;
  turn: Seat;
  status: GameStatus;
  result: GameResult;
  whiteMsRemaining: number | null;
  blackMsRemaining: number | null;
  turnStartedAt: string | null;
}

export interface GameRepository {
  createGame(input: CreateGameInput): Promise<GameRecord>;
  getGame(gameId: string): Promise<GameRecord | null>;
  joinGame(input: JoinGameInput): Promise<GameRecord>;
  persistMove(input: PersistMoveInput): Promise<GameRecord>;
  finishGame(gameId: string, status: GameStatus, result: GameResult): Promise<GameRecord>;
}
