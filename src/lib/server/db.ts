import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

declare global {
	var fireflyPool: pg.Pool | undefined;
	var fireflySchemaReady: Promise<void> | undefined;
}

function databaseUrl() {
	const value = import.meta.env.DATABASE_URL || process.env.DATABASE_URL;
	if (!value) throw new Error("DATABASE_URL is not configured");
	return value;
}

export function getPool() {
	if (!globalThis.fireflyPool) {
		globalThis.fireflyPool = new Pool({
			connectionString: databaseUrl(),
			max: 5,
			idleTimeoutMillis: 30_000,
		});
	}
	return globalThis.fireflyPool;
}

export async function ensureSchema() {
	if (!globalThis.fireflySchemaReady) {
		globalThis.fireflySchemaReady = (async () => {
			const sql = await fs.readFile(path.resolve("db/schema.sql"), "utf8");
			await getPool().query(sql);
		})();
	}
	return globalThis.fireflySchemaReady;
}

export async function query<T extends pg.QueryResultRow>(text: string, values: unknown[] = []) {
	await ensureSchema();
	return getPool().query<T>(text, values);
}
