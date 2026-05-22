import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import type { ClientWsMessage, Seat, ServerWsMessage } from "@chesswebapp/shared";
import { ClientError, GameService } from "./gameService.js";
import type { GameRepository } from "./repository.js";

interface Connection {
  gameId: string;
  seat: Seat | "spectator";
  socket: WebSocket;
}

export function buildApp(repository: GameRepository): FastifyInstance {
  const app = Fastify({ logger: true });
  const service = new GameService(repository);
  const connections = new Set<Connection>();
  const webSocketServer = new WebSocketServer({ noServer: true });

  app.server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const match = url.pathname.match(/^\/ws\/games\/([^/]+)$/);
    if (!match) {
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      handleGameSocket(webSocket, decodeURIComponent(match[1]), url.searchParams.get("playerToken") ?? undefined);
    });
  });

  app.addHook("onClose", async () => {
    for (const connection of connections) {
      connection.socket.close();
    }
    webSocketServer.close();
  });

  app.post<{ Body: { displayName?: string } }>("/api/games", async (request, reply) => {
    const created = await service.createGame(request.body.displayName ?? "");
    return reply.code(201).send(created);
  });

  app.post<{ Params: { gameId: string }; Body: { displayName?: string } }>("/api/games/:gameId/join", async (request) => {
    const joined = await service.joinGame(request.params.gameId, request.body.displayName ?? "");
    await broadcast(request.params.gameId, { type: "player:joined", snapshot: await snapshotWithConnections(request.params.gameId) });
    return joined;
  });

  app.get<{ Params: { gameId: string } }>("/api/games/:gameId", async (request) => {
    return service.getSnapshot(request.params.gameId, connectedSeats(request.params.gameId));
  });

  app.post<{ Params: { gameId: string }; Body: { playerToken?: string } }>("/api/games/:gameId/resign", async (request) => {
    const snapshot = await service.resign(request.params.gameId, request.body.playerToken);
    await broadcast(request.params.gameId, { type: "game:ended", snapshot });
    return snapshot;
  });

  function handleGameSocket(socket: WebSocket, gameId: string, playerToken?: string) {
    const connection: Connection = { gameId, seat: "spectator", socket };
    connections.add(connection);

    socket.on("message", async (raw: RawData) => {
      try {
        const message = JSON.parse(raw.toString()) as ClientWsMessage;
        if (message.type !== "move:submit") {
          send(socket, { type: "move:rejected", reason: "Unknown message type." });
          return;
        }

        const result = await service.submitMove(gameId, playerToken, message.from, message.to, message.promotion);
        await broadcast(gameId, { type: "move:accepted", snapshot: await snapshotWithConnections(gameId), move: result.move });
        if (result.snapshot.status !== "active") {
          await broadcast(gameId, { type: "game:ended", snapshot: await snapshotWithConnections(gameId) });
        }
      } catch (error) {
        send(socket, { type: "move:rejected", reason: toMessage(error) });
      }
    });

    socket.on("close", async () => {
      connections.delete(connection);
      await broadcast(gameId, { type: "game:snapshot", snapshot: await snapshotWithConnections(gameId), seat: connection.seat });
    });

    void initializeConnection();

    async function initializeConnection(): Promise<void> {
      try {
        connection.seat = await service.getSeatForToken(gameId, playerToken);
        send(socket, { type: "game:snapshot", snapshot: await snapshotWithConnections(gameId), seat: connection.seat });
      } catch (error) {
        send(socket, { type: "move:rejected", reason: toMessage(error) });
        socket.close();
      }
    }
  }

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error instanceof ClientError ? error.statusCode : 500;
    reply.code(statusCode).send({ error: toMessage(error) });
  });

  if (process.env.NODE_ENV === "production") {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientDist = path.resolve(__dirname, "../../client/dist");
    app.register(fastifyStatic, {
      root: clientDist,
      wildcard: false
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith("/api") || request.raw.url?.startsWith("/ws")) {
        reply.code(404).send({ error: "Not found." });
        return;
      }
      reply.sendFile("index.html");
    });
  }

  async function snapshotWithConnections(gameId: string) {
    return service.getSnapshot(gameId, connectedSeats(gameId));
  }

  function connectedSeats(gameId: string): Set<Seat> {
    const seats = new Set<Seat>();
    for (const connection of connections) {
      if (connection.gameId === gameId && connection.seat !== "spectator") {
        seats.add(connection.seat);
      }
    }
    return seats;
  }

  async function broadcast(gameId: string, message: ServerWsMessage): Promise<void> {
    const data = JSON.stringify(message);
    for (const connection of connections) {
      if (connection.gameId === gameId && connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(data);
      }
    }
  }

  return app;
}

function send(socket: WebSocket, message: ServerWsMessage): void {
  socket.send(JSON.stringify(message));
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}
