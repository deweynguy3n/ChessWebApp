# ChessWebApp

A full-stack realtime chess app built as a resume project with React, TypeScript, Fastify, WebSockets, Postgres, raw SQL migrations, and `chess.js`.

## Local setup

```bash
export PATH="$PWD/.tools/node-v24.14.0-darwin-arm64/bin:$PATH"
npm install
docker compose up -d
npm run migrate
npm run dev:server
```

Open `http://localhost:8080`.

For frontend-only Vite development, run `npm run dev:client` and keep the server on `http://localhost:8080`.

## Scripts

- `npm run build` builds shared types, client, and server.
- `npm run test` runs backend unit/API/WebSocket tests.
- `npm run migrate` applies raw SQL migrations to Postgres.
- `npm run typecheck` checks all workspaces.
