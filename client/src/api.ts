import type { CreateGameResponse, GameSnapshot, JoinGameResponse } from "@chesswebapp/shared";

const jsonHeaders = { "Content-Type": "application/json" };

export async function createGame(displayName: string, timeControlSeconds?: number | null): Promise<CreateGameResponse> {
  const response = await fetch("/api/games", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ displayName, timeControlSeconds })
  });
  return readJson(response);
}

export async function joinGame(gameId: string, displayName: string): Promise<JoinGameResponse> {
  const response = await fetch(`/api/games/${gameId}/join`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ displayName })
  });
  return readJson(response);
}

export async function fetchGame(gameId: string): Promise<GameSnapshot> {
  return readJson(await fetch(`/api/games/${gameId}`));
}

export async function resignGame(gameId: string, playerToken: string): Promise<GameSnapshot> {
  const response = await fetch(`/api/games/${gameId}/resign`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ playerToken })
  });
  return readJson(response);
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed.");
  }
  return body;
}
