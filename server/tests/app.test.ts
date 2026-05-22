import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { FastifyInstance } from "fastify";
import type { CreateGameResponse, JoinGameResponse, ServerWsMessage } from "@chesswebapp/shared";
import { buildApp } from "../src/app.js";
import { InMemoryGameRepository } from "../src/memoryRepository.js";

let app: FastifyInstance;

beforeEach(async () => {
  app = buildApp(new InMemoryGameRepository());
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe("HTTP API", () => {
  it("creates, joins, blocks a third player, and fetches snapshots", async () => {
    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/games",
      payload: { displayName: "Ada" }
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json<CreateGameResponse>();
    expect(created.seat).toBe("white");

    const joinedResponse = await app.inject({
      method: "POST",
      url: `/api/games/${created.gameId}/join`,
      payload: { displayName: "Grace" }
    });
    expect(joinedResponse.statusCode).toBe(200);
    const joined = joinedResponse.json<JoinGameResponse>();
    expect(joined.seat).toBe("black");

    const blocked = await app.inject({
      method: "POST",
      url: `/api/games/${created.gameId}/join`,
      payload: { displayName: "Linus" }
    });
    expect(blocked.statusCode).toBe(409);

    const fetched = await app.inject({ method: "GET", url: `/api/games/${created.gameId}` });
    expect(fetched.json().players).toHaveLength(2);
  });
});

describe("WebSocket API", () => {
  it("broadcasts accepted moves and rejects illegal moves", async () => {
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const created = await createViaHttp(address, "Ada");
    const joined = await joinViaHttp(address, created.gameId, "Grace");

    const whiteSocket = new WebSocket(`${address.replace("http", "ws")}/ws/games/${created.gameId}?playerToken=${created.playerToken}`);
    const blackSocket = new WebSocket(`${address.replace("http", "ws")}/ws/games/${created.gameId}?playerToken=${joined.playerToken}`);
    const whiteSnapshot = nextMessage(whiteSocket);
    const blackSnapshot = nextMessage(blackSocket);

    await Promise.all([opened(whiteSocket), opened(blackSocket)]);
    await Promise.all([whiteSnapshot, blackSnapshot]);

    const acceptedPromise = waitFor(blackSocket, "move:accepted");
    whiteSocket.send(JSON.stringify({ type: "move:submit", from: "e2", to: "e4" }));
    const accepted = await acceptedPromise;
    expect(accepted.snapshot.moves[0].san).toBe("e4");

    const rejectedPromise = waitFor(whiteSocket, "move:rejected");
    whiteSocket.send(JSON.stringify({ type: "move:submit", from: "d2", to: "d4" }));
    const rejected = await rejectedPromise;
    expect(rejected.reason).toBe("It is not your turn.");

    whiteSocket.close();
    blackSocket.close();
  });
});

async function createViaHttp(address: string, displayName: string): Promise<CreateGameResponse> {
  const response = await fetch(`${address}/api/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName })
  });
  return response.json() as Promise<CreateGameResponse>;
}

async function joinViaHttp(address: string, gameId: string, displayName: string): Promise<JoinGameResponse> {
  const response = await fetch(`${address}/api/games/${gameId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName })
  });
  return response.json() as Promise<JoinGameResponse>;
}

function opened(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => socket.once("open", resolve));
}

function nextMessage(socket: WebSocket): Promise<ServerWsMessage> {
  return new Promise((resolve) => {
    socket.once("message", (data) => resolve(JSON.parse(data.toString()) as ServerWsMessage));
  });
}

async function waitFor<T extends ServerWsMessage["type"]>(socket: WebSocket, type: T): Promise<Extract<ServerWsMessage, { type: T }>> {
  for (;;) {
    const message = await nextMessage(socket);
    if (message.type === type) {
      return message as Extract<ServerWsMessage, { type: T }>;
    }
  }
}
