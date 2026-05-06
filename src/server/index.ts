import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";

import { Hono } from "hono";

import { createApiApp } from "./apiApp";
import { createSqliteWorkbookRepository } from "./sqliteWorkbookRepository";

const defaultPort = 3000;
const defaultDatabasePath = "data/maybe.sqlite";
const defaultDistRoot = "dist";

const getPort = (): number => {
  const rawPort = process.env.PORT;
  if (!rawPort) {
    return defaultPort;
  }

  const port = Number.parseInt(rawPort, 10);
  return Number.isFinite(port) ? port : defaultPort;
};

const getDatabasePath = (): string =>
  process.env.MAYBE_DB_PATH ?? defaultDatabasePath;

const ensureDatabaseDirectory = (databasePath: string): void => {
  if (databasePath === ":memory:") {
    return;
  }

  mkdirSync(dirname(databasePath), { recursive: true });
};

const isSafeAssetPath = (assetPath: string): boolean =>
  assetPath !== ".." &&
  !assetPath.startsWith(`..${sep}`) &&
  !assetPath.includes(`${sep}..${sep}`);

const getStaticAssetPath = (request: Request): string | null => {
  const { pathname } = new URL(request.url);
  const decodedPathname = decodeURIComponent(pathname);
  const relativePath =
    decodedPathname === "/" ? "index.html" : decodedPathname.slice(1);
  const normalizedPath = normalize(relativePath);

  return isSafeAssetPath(normalizedPath) ? normalizedPath : null;
};

const serveStaticAsset = async (
  request: Request,
  distRoot: string,
): Promise<Response | null> => {
  const assetPath = getStaticAssetPath(request);
  if (!assetPath) {
    return null;
  }

  const assetFile = Bun.file(join(distRoot, assetPath));
  if (await assetFile.exists()) {
    return new Response(assetFile);
  }

  const fallbackFile = Bun.file(join(distRoot, "index.html"));
  if (await fallbackFile.exists()) {
    return new Response(fallbackFile);
  }

  return null;
};

const createServerApp = () => {
  const databasePath = getDatabasePath();
  ensureDatabaseDirectory(databasePath);

  const database = new Database(databasePath);
  const app = new Hono();

  app.route(
    "/",
    createApiApp({
      workbook: {
        repository: createSqliteWorkbookRepository(database),
      },
    }),
  );

  if (process.env.MAYBE_SERVE_STATIC !== "false") {
    const distRoot = process.env.MAYBE_DIST_DIR ?? defaultDistRoot;

    app.get("*", async (context) => {
      const response = await serveStaticAsset(context.req.raw, distRoot);
      return response ?? context.notFound();
    });
  }

  return app;
};

const app = createServerApp();
const port = getPort();

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`Maybe server listening on http://localhost:${port}`);
