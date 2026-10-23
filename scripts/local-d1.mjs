import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
export function createLocalD1(filename = ":memory:") {
  if (filename !== ":memory:")
    mkdirSync(path.dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS _easy_eat_migrations(name TEXT PRIMARY KEY)",
  );
  const migrations = path.resolve(import.meta.dirname, "../drizzle");
  for (const name of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    if (
      sqlite
        .prepare("SELECT name FROM _easy_eat_migrations WHERE name=?")
        .get(name)
    )
      continue;
    sqlite.exec("BEGIN");
    try {
      sqlite.exec(readFileSync(path.join(migrations, name), "utf8"));
      sqlite
        .prepare("INSERT INTO _easy_eat_migrations(name) VALUES(?)")
        .run(name);
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  const createStatement = (sql, args = []) => ({
    bind(...values) {
      return createStatement(sql, values);
    },
    async first(column) {
      const row = sqlite.prepare(sql).get(...args) || null;
      return column ? (row?.[column] ?? null) : row;
    },
    async all() {
      const results = sqlite.prepare(sql).all(...args);
      return { results, success: true, meta: {} };
    },
    async run() {
      const result = sqlite.prepare(sql).run(...args);
      return {
        results: [],
        success: true,
        meta: {
          changes: Number(result.changes),
          last_row_id: Number(result.lastInsertRowid),
        },
      };
    },
  });
  return {
    sqlite,
    prepare: createStatement,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    close() {
      sqlite.close();
    },
  };
}
