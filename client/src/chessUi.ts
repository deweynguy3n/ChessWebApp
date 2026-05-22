import { Chess, type Square } from "chess.js";
import type { GameSnapshot, PromotionPiece, Seat } from "@chesswebapp/shared";

export const promotionPieces: PromotionPiece[] = ["q", "r", "b", "n"];

export function getBoard(snapshot: GameSnapshot, perspective: Seat | "spectator") {
  const chess = new Chess(snapshot.fen);
  const board = chess.board();
  const rows = perspective === "black" ? [...board].reverse() : board;
  return rows.map((row) => (perspective === "black" ? [...row].reverse() : row));
}

export function squareName(rowIndex: number, colIndex: number, perspective: Seat | "spectator"): Square {
  const rank = perspective === "black" ? rowIndex + 1 : 8 - rowIndex;
  const fileIndex = perspective === "black" ? 7 - colIndex : colIndex;
  return `${"abcdefgh"[fileIndex]}${rank}` as Square;
}

export function legalTargets(fen: string, from: Square): Square[] {
  const chess = new Chess(fen);
  return chess.moves({ square: from, verbose: true }).map((move) => move.to);
}

export function isPromotionMove(fen: string, from: Square, to: Square): boolean {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece || piece.type !== "p") return false;
  return chess.moves({ square: from, verbose: true }).some((move) => move.to === to && Boolean(move.promotion));
}

export function statusText(snapshot: GameSnapshot): string {
  if (snapshot.status === "waiting") return "Waiting for Black to join";
  if (snapshot.status === "active") return `${capitalize(snapshot.turn)} to move`;
  if (snapshot.status === "checkmate") return `Checkmate ${snapshot.result ?? ""}`;
  if (snapshot.status === "stalemate") return "Stalemate";
  if (snapshot.status === "draw") return "Draw";
  if (snapshot.status === "resigned") return `Resigned ${snapshot.result ?? ""}`;
  if (snapshot.status === "timeout") return `Timeout ${snapshot.result ?? ""}`;
  return snapshot.status;
}

export function clockText(milliseconds: number | null): string {
  if (milliseconds === null) return "--";
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function playerName(snapshot: GameSnapshot, seat: Seat): string {
  return snapshot.players.find((player) => player.seat === seat)?.displayName ?? (seat === "white" ? "White" : "Black");
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
