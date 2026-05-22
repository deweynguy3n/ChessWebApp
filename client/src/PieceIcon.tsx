import type { Color, PieceSymbol } from "chess.js";

interface PieceIconProps {
  color: Color;
  type: PieceSymbol;
  label?: string;
}

export function PieceIcon({ color, type, label }: PieceIconProps) {
  return (
    <svg className={`piece-icon ${color === "w" ? "white-piece" : "black-piece"}`} viewBox="0 0 64 64" aria-label={label} role={label ? "img" : undefined} aria-hidden={label ? undefined : true}>
      {shapeFor(type)}
    </svg>
  );
}

function shapeFor(type: PieceSymbol) {
  if (type === "p") return <Pawn />;
  if (type === "n") return <Knight />;
  if (type === "b") return <Bishop />;
  if (type === "r") return <Rook />;
  if (type === "q") return <Queen />;
  return <King />;
}

function Base() {
  return (
    <>
      <path className="piece-fill" d="M18 52h28l4 7H14l4-7Z" />
      <path className="piece-line" d="M18 52h28" />
    </>
  );
}

function Pawn() {
  return (
    <>
      <circle className="piece-fill" cx="32" cy="17" r="9" />
      <path className="piece-fill" d="M23 48c2-11 5-18 9-18s7 7 9 18H23Z" />
      <Base />
    </>
  );
}

function Knight() {
  return (
    <>
      <path className="piece-fill" d="M20 50c1-8 4-15 10-21l-6-8 7-11 15 7 3 12-8 7 6 14H20Z" />
      <path className="piece-cutout" d="M30 18l-3 5 6 1" />
      <circle className="piece-dot" cx="39" cy="24" r="2" />
      <Base />
    </>
  );
}

function Bishop() {
  return (
    <>
      <circle className="piece-fill" cx="32" cy="13" r="7" />
      <path className="piece-fill" d="M22 48c1-15 4-27 10-33 6 6 9 18 10 33H22Z" />
      <path className="piece-cutout" d="M39 19 27 35" />
      <Base />
    </>
  );
}

function Rook() {
  return (
    <>
      <path className="piece-fill" d="M18 12h8v6h5v-6h7v6h5v-6h8v15H18V12Z" />
      <path className="piece-fill" d="M22 27h20l3 21H19l3-21Z" />
      <Base />
    </>
  );
}

function Queen() {
  return (
    <>
      <circle className="piece-fill" cx="18" cy="15" r="5" />
      <circle className="piece-fill" cx="32" cy="10" r="5" />
      <circle className="piece-fill" cx="46" cy="15" r="5" />
      <path className="piece-fill" d="M16 23 23 48h18l7-25-10 9-6-14-6 14-10-9Z" />
      <Base />
    </>
  );
}

function King() {
  return (
    <>
      <path className="piece-line" d="M32 7v15M25 14h14" />
      <path className="piece-fill" d="M22 48c1-14 5-23 10-26 5 3 9 12 10 26H22Z" />
      <path className="piece-fill" d="M22 25h20l-4 10H26l-4-10Z" />
      <Base />
    </>
  );
}
