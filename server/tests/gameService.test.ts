import { describe, expect, it } from "vitest";
import { GameService } from "../src/gameService.js";
import { InMemoryGameRepository } from "../src/memoryRepository.js";

describe("GameService", () => {
  it("creates, joins, and rejects out-of-turn moves", async () => {
    const service = new GameService(new InMemoryGameRepository());
    const created = await service.createGame("Ada");
    const joined = await service.joinGame(created.gameId, "Grace");

    await expect(service.submitMove(created.gameId, joined.playerToken, "e7", "e5")).rejects.toThrow("It is not your turn.");
  });

  it("persists legal moves and detects checkmate", async () => {
    const service = new GameService(new InMemoryGameRepository());
    const white = await service.createGame("Ada");
    const black = await service.joinGame(white.gameId, "Grace");

    await service.submitMove(white.gameId, white.playerToken, "f2", "f3");
    await service.submitMove(white.gameId, black.playerToken, "e7", "e5");
    await service.submitMove(white.gameId, white.playerToken, "g2", "g4");
    const mate = await service.submitMove(white.gameId, black.playerToken, "d8", "h4");

    expect(mate.snapshot.status).toBe("checkmate");
    expect(mate.snapshot.result).toBe("0-1");
    expect(mate.move.san).toContain("#");
  });

  it("marks resignation with the opponent result", async () => {
    const service = new GameService(new InMemoryGameRepository());
    const white = await service.createGame("Ada");
    await service.joinGame(white.gameId, "Grace");

    const snapshot = await service.resign(white.gameId, white.playerToken);

    expect(snapshot.status).toBe("resigned");
    expect(snapshot.result).toBe("0-1");
  });
});
