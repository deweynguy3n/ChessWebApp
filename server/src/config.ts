export interface AppConfig {
  port: number;
  databaseUrl?: string;
  clientOrigin: string;
  useMemoryDb: boolean;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 8080),
    databaseUrl: process.env.DATABASE_URL,
    clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    useMemoryDb: process.env.MEMORY_DB === "true" || !process.env.DATABASE_URL
  };
}
