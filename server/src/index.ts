import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { InMemoryGameRepository } from "./memoryRepository.js";
import { PostgresGameRepository } from "./postgresRepository.js";

const config = loadConfig();
const repository = config.useMemoryDb ? new InMemoryGameRepository() : new PostgresGameRepository(config.databaseUrl!);
const app = buildApp(repository);

await app.listen({ host: "0.0.0.0", port: config.port });
