export type Seat = "white" | "black";
export type GameStatus = "waiting" | "active" | "checkmate" | "stalemate" | "draw" | "resigned" | "timeout";
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | null;
export type PromotionPiece = "q" | "r" | "b" | "n";

export interface PlayerSummary {
  seat: Seat;
  displayName: string;
  connected: boolean;
}

export interface MoveSummary {
  id: string;
  moveNumber: number;
  color: Seat;
  from: string;
  to: string;
  promotion: PromotionPiece | null;
  san: string;
  fenAfter: string;
  createdAt: string;
}

export interface CapturedPieces {
  white: string[];
  black: string[];
}

export interface GameSnapshot {
  id: string;
  status: GameStatus;
  fen: string;
  pgn: string;
  turn: Seat;
  result: GameResult;
  timeControlSeconds: number | null;
  clocks: Record<Seat, number | null>;
  turnStartedAt: string | null;
  players: PlayerSummary[];
  moves: MoveSummary[];
  captured: CapturedPieces;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameRequest {
  displayName: string;
  timeControlSeconds?: number | null;
}

export interface JoinGameRequest {
  displayName: string;
}

export interface CreateGameResponse {
  gameId: string;
  seat: Seat;
  playerToken: string;
  snapshot: GameSnapshot;
}

export interface JoinGameResponse {
  gameId: string;
  seat: Seat;
  playerToken: string;
  snapshot: GameSnapshot;
}

export interface SubmitMovePayload {
  type: "move:submit";
  from: string;
  to: string;
  promotion?: PromotionPiece;
}

export interface GameSnapshotEvent {
  type: "game:snapshot";
  snapshot: GameSnapshot;
  seat: Seat | "spectator";
}

export interface MoveAcceptedEvent {
  type: "move:accepted";
  snapshot: GameSnapshot;
  move: MoveSummary;
}

export interface MoveRejectedEvent {
  type: "move:rejected";
  reason: string;
}

export interface PlayerJoinedEvent {
  type: "player:joined";
  snapshot: GameSnapshot;
}

export interface GameEndedEvent {
  type: "game:ended";
  snapshot: GameSnapshot;
}

export type ClientWsMessage = SubmitMovePayload;

export type ServerWsMessage =
  | GameSnapshotEvent
  | MoveAcceptedEvent
  | MoveRejectedEvent
  | PlayerJoinedEvent
  | GameEndedEvent;
