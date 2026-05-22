import { describe, expect, it } from "vitest";
import { GameService } from "../src/gameService.js";
import { InMemoryGameRepository } from "../src/memoryRepository.js";
import type { GameRecord } from "../src/repository.js";

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

  it("tracks one-minute clocks and deducts time from the moving player", async () => {
    const service = new GameService(new InMemoryGameRepository());
    const white = await service.createGame("Ada", 60);
    const black = await service.joinGame(white.gameId, "Grace");

    expect(black.snapshot.timeControlSeconds).toBe(60);
    expect(black.snapshot.clocks.white).toBe(60000);
    expect(black.snapshot.clocks.black).toBe(60000);

    await new Promise((resolve) => setTimeout(resolve, 20));
    const moved = await service.submitMove(white.gameId, white.playerToken, "e2", "e4");

    expect(moved.snapshot.clocks.white).toBeLessThan(60000);
    expect(moved.snapshot.clocks.black).toBe(60000);
  });

  it("ends a timed game when the active player flags", async () => {
    const repository = new InMemoryGameRepository();
    const service = new GameService(repository);
    const white = await service.createGame("Ada", 60);
    await service.joinGame(white.gameId, "Grace");

    const records = (repository as unknown as { records: Map<string, GameRecord> }).records;
    const record = records.get(white.gameId);
    if (!record) throw new Error("Expected game record to exist.");
    record.game.whiteMsRemaining = 1;
    record.game.turnStartedAt = new Date(Date.now() - 1000).toISOString();

    const snapshot = await service.getSnapshot(white.gameId);

    expect(snapshot.status).toBe("timeout");
    expect(snapshot.result).toBe("0-1");
  });
});
