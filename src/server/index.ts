import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";

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

  const directoryPath = databasePath.split("/").slice(0, -1).join("/");
  if (directoryPath) {
    mkdirSync(directoryPath, { recursive: true });
  }
};

const getStaticAssetPath = (request: Request): string | null => {
  const { pathname } = new URL(request.url);
  const decodedPathname = decodeURIComponent(pathname);
  const pathSegments = decodedPathname.split("/");

  if (pathSegments.includes("..")) {
    return null;
  }

  const relativePath =
    decodedPathname === "/" ? "index.html" : decodedPathname.slice(1);
  return relativePath || "index.html";
};

const serveStaticAsset = async (
  request: Request,
  distRoot: string,
): Promise<Response | null> => {
  const assetPath = getStaticAssetPath(request);
  if (!assetPath) {
    return null;
  }

  const assetFile = Bun.file(`${distRoot}/${assetPath}`);
  if (await assetFile.exists()) {
    return new Response(assetFile);
  }

  const fallbackFile = Bun.file(`${distRoot}/index.html`);
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
