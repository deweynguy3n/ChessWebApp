import React from "react";
import { createRoot } from "react-dom/client";
import { ChessApp } from "./ChessApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ChessApp />
  </React.StrictMode>
);
