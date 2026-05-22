import type { Seat } from "@chesswebapp/shared";

export interface StoredSeat {
  seat: Seat;
  playerToken: string;
}

export function saveSeat(gameId: string, seat: Seat, playerToken: string): void {
  const value = JSON.stringify({ seat, playerToken });
  sessionStorage.setItem(key(gameId), value);
}

export function loadSeat(gameId: string): StoredSeat | null {
  const urlSeat = seatFromUrl();
  const urlToken = new URLSearchParams(window.location.search).get("playerToken");
  if (urlSeat && urlToken) {
    return { seat: urlSeat, playerToken: urlToken };
  }

  const raw = sessionStorage.getItem(key(gameId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSeat;
  } catch {
    return null;
  }
}

function key(gameId: string): string {
  return `chesswebapp:${gameId}:seat`;
}

function seatFromUrl(): Seat | null {
  const seat = new URLSearchParams(window.location.search).get("seat");
  return seat === "white" || seat === "black" ? seat : null;
}
