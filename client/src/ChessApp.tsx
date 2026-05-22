import { useEffect, useRef, useState } from "react";
import type { GameSnapshot, PromotionPiece, Seat, ServerWsMessage } from "@chesswebapp/shared";
import { createGame, fetchGame, joinGame, resignGame } from "./api";
import { clockText, getBoard, isPromotionMove, legalTargets, pieceSymbols, playerName, promotionPieces, squareName, statusText } from "./chessUi";
import { loadSeat, saveSeat, type StoredSeat } from "./storage";
import type { Square } from "chess.js";

type Route = { page: "home" } | { page: "game"; gameId: string };

interface PendingPromotion {
  from: Square;
  to: Square;
}

export function ChessApp() {
  const [route, setRoute] = useState<Route>(() => currentRoute());

  useEffect(() => {
    const onPop = () => setRoute(currentRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(path: string) {
    window.history.pushState(null, "", path);
    setRoute(currentRoute());
  }

  return route.page === "home" ? <Home onNavigate={navigate} /> : <GameView gameId={route.gameId} onNavigate={navigate} />;
}

function Home({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [timedMode, setTimedMode] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await createGame(displayName, timedMode ? 60 : null);
      saveSeat(created.gameId, created.seat, created.playerToken);
      onNavigate(playerGamePath(created.gameId, created.seat, created.playerToken));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create game.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="home-shell">
      <section className="home-panel">
        <p className="eyebrow">Realtime chess</p>
        <h1>ChessWebApp</h1>
        <p className="lede">Create an invite-link match, share it with an opponent, and play a rules-valid chess game in real time.</p>
        <form className="name-form" onSubmit={submit}>
          <label htmlFor="displayName">Display name</label>
          <div className="inline-form">
            <input id="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ada" maxLength={32} />
            <button disabled={busy}>{busy ? "Creating" : "Create game"}</button>
          </div>
          <label className="toggle-row">
            <input type="checkbox" checked={timedMode} onChange={(event) => setTimedMode(event.target.checked)} />
            <span>1 minute timed mode</span>
          </label>
          {error ? <p className="error">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}

function GameView({ gameId, onNavigate }: { gameId: string; onNavigate: (path: string) => void }) {
  const [identity, setIdentity] = useState<StoredSeat | null>(() => loadSeat(gameId));
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [seat, setSeat] = useState<Seat | "spectator">(identity?.seat ?? "spectator");
  const [joinName, setJoinName] = useState("");
  const [selected, setSelected] = useState<Square | null>(null);
  const [targets, setTargets] = useState<Square[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const socketRef = useRef<WebSocket | null>(null);
  const inviteUrl = `${window.location.origin}/game/${gameId}`;

  useEffect(() => {
    const loaded = loadSeat(gameId);
    setIdentity(loaded);
    setSeat(loaded?.seat ?? "spectator");
  }, [gameId]);

  useEffect(() => {
    fetchGame(gameId).then(setSnapshot).catch((error) => setError(error instanceof Error ? error.message : "Could not load game."));
  }, [gameId]);

  useEffect(() => {
    const token = identity?.playerToken;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const query = token ? `?playerToken=${encodeURIComponent(token)}` : "";
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws/games/${gameId}${query}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      if (socketRef.current !== socket) {
        return;
      }
      const message = JSON.parse(event.data) as ServerWsMessage;
      if ("snapshot" in message) {
        setSnapshot(message.snapshot);
      }
      if (message.type === "game:snapshot") {
        setSeat(message.seat);
      }
      if (message.type === "move:rejected") {
        setError(message.reason);
      } else {
        setError("");
      }
    };

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };

    return () => socket.close();
  }, [gameId, identity?.playerToken]);

  useEffect(() => {
    if (!snapshot?.timeControlSeconds || snapshot.status !== "active") {
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [snapshot?.status, snapshot?.timeControlSeconds]);

  const board = snapshot ? getBoard(snapshot, seat) : [];
  const blackSeatTaken = snapshot?.players.some((player) => player.seat === "black") ?? false;
  const canJoin = snapshot?.status === "waiting" && !blackSeatTaken && seat !== "black";
  const canMove = snapshot?.status === "active" && snapshot.turn === seat;

  async function submitJoin(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const joined = await joinGame(gameId, joinName);
      saveSeat(gameId, joined.seat, joined.playerToken);
      setIdentity({ seat: joined.seat, playerToken: joined.playerToken });
      setSeat(joined.seat);
      setSnapshot(joined.snapshot);
      window.history.replaceState(null, "", playerGamePath(gameId, joined.seat, joined.playerToken));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not join game.");
    }
  }

  function selectSquare(square: Square) {
    if (!snapshot || !canMove) return;
    if (selected && targets.includes(square)) {
      if (isPromotionMove(snapshot.fen, selected, square)) {
        setPendingPromotion({ from: selected, to: square });
        return;
      }
      sendMove(selected, square);
      return;
    }
    const legal = legalTargets(snapshot.fen, square);
    if (legal.length > 0) {
      setSelected(square);
      setTargets(legal);
    } else {
      setSelected(null);
      setTargets([]);
    }
  }

  function sendMove(from: Square, to: Square, promotion?: PromotionPiece) {
    socketRef.current?.send(JSON.stringify({ type: "move:submit", from, to, promotion }));
    setSelected(null);
    setTargets([]);
    setPendingPromotion(null);
  }

  async function copyInvite() {
    setError("");
    try {
      await copyText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Could not copy automatically. Select the invite link below.");
    }
  }

  async function resign() {
    if (!identity?.playerToken) return;
    const resigned = await resignGame(gameId, identity.playerToken);
    setSnapshot(resigned);
  }

  if (!snapshot) {
    return <main className="loading">Loading game...</main>;
  }

  return (
    <main className="game-shell">
      <section className="player-strip top">
        <PlayerCard now={now} snapshot={snapshot} seat="black" />
        <div className="status-pill">{statusText(snapshot)}</div>
      </section>

      <section className="board-area">
        <div className="board" aria-label="Chess board">
          {board.map((row, rowIndex) =>
            row.map((piece, colIndex) => {
              const square = squareName(rowIndex, colIndex, seat);
              const isDark = (rowIndex + colIndex) % 2 === 1;
              return (
                <button
                  key={square}
                  className={`square ${isDark ? "dark" : "light"} ${selected === square ? "selected" : ""} ${targets.includes(square) ? "target" : ""}`}
                  onClick={() => selectSquare(square)}
                  aria-label={square}
                >
                  {piece ? <span className={`piece ${piece.color === "w" ? "white-piece" : "black-piece"}`}>{pieceSymbols[piece.color + piece.type]}</span> : null}
                  <span className="coord">{square}</span>
                </button>
              );
            })
          )}
        </div>

        <aside className="side-panel">
          <div className="panel-section">
            <h2>Match</h2>
            <p className="muted">You are {seat === "spectator" ? "spectating" : seat}.</p>
            <label className="invite-label" htmlFor="inviteUrl">Invite link</label>
            <input id="inviteUrl" className="invite-input" value={inviteUrl} readOnly onFocus={(event) => event.target.select()} />
            <div className="actions">
              <button type="button" onClick={copyInvite}>{copied ? "Copied" : "Copy invite"}</button>
              <button type="button" onClick={() => onNavigate("/")}>New game</button>
              {seat !== "spectator" && snapshot.status === "active" ? <button type="button" className="danger" onClick={resign}>Resign</button> : null}
            </div>
          </div>

          {canJoin ? (
            <form className="panel-section" onSubmit={submitJoin}>
              <h2>Join as Black</h2>
              <input value={joinName} onChange={(event) => setJoinName(event.target.value)} placeholder="Your name" maxLength={32} />
              <button>Join game</button>
            </form>
          ) : null}

          <div className="panel-section captured">
            <h2>Captured</h2>
            <p>White: {snapshot.captured.white.map((piece) => pieceSymbols["w" + piece]).join(" ") || "None"}</p>
            <p>Black: {snapshot.captured.black.map((piece) => pieceSymbols["b" + piece]).join(" ") || "None"}</p>
          </div>

          <div className="panel-section moves">
            <h2>Moves</h2>
            <ol>
              {snapshot.moves.map((move) => (
                <li key={move.id}>
                  <span>{move.moveNumber}.</span>
                  <strong>{move.color === "white" ? "White" : "Black"}</strong>
                  <span>{move.san}</span>
                </li>
              ))}
            </ol>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </aside>
      </section>

      <section className="player-strip bottom">
        <PlayerCard now={now} snapshot={snapshot} seat="white" />
      </section>

      {pendingPromotion ? (
        <div className="modal-backdrop">
          <div className="promotion-modal">
            <h2>Promote pawn</h2>
            <div className="promotion-options">
              {promotionPieces.map((piece) => (
                <button key={piece} onClick={() => sendMove(pendingPromotion.from, pendingPromotion.to, piece)}>
                  {pieceSymbols[(seat === "black" ? "b" : "w") + piece]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function PlayerCard({ now, snapshot, seat }: { now: number; snapshot: GameSnapshot; seat: Seat }) {
  const player = snapshot.players.find((candidate) => candidate.seat === seat);
  const clock = displayClock(snapshot, seat, now);
  return (
    <div className="player-card">
      <span className={`connection ${player?.connected ? "online" : ""}`} />
      <div>
        <strong>{playerName(snapshot, seat)}</strong>
        <p>{seat === "white" ? "White" : "Black"}</p>
      </div>
      {clock !== null ? <span className={`clock ${snapshot.turn === seat && snapshot.status === "active" ? "active" : ""}`}>{clockText(clock)}</span> : null}
    </div>
  );
}

function displayClock(snapshot: GameSnapshot, seat: Seat, now: number): number | null {
  const baseClock = snapshot.clocks[seat];
  if (baseClock === null) return null;
  if (snapshot.status !== "active" || snapshot.turn !== seat || !snapshot.turnStartedAt) {
    return baseClock;
  }
  return Math.max(0, baseClock - Math.max(0, now - new Date(snapshot.turnStartedAt).getTime()));
}

function currentRoute(): Route {
  const match = window.location.pathname.match(/^\/game\/([^/]+)$/);
  return match ? { page: "game", gameId: match[1] } : { page: "home" };
}

function playerGamePath(gameId: string, seat: Seat, playerToken: string): string {
  const params = new URLSearchParams({ seat, playerToken });
  return `/game/${gameId}?${params.toString()}`;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for embedded browsers or permission-denied clipboard contexts.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command failed.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}
