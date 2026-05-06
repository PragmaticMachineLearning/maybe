import { Hono } from "hono";

import { createAssistantHandler } from "./assistantRoute";
import {
  createWorkbookHandler,
  type CreateWorkbookHandlerOptions,
} from "./workbookRoute";

type ApiHandler = (request: Request) => Promise<Response> | Response;

interface CreateApiAppOptions {
  assistantHandler?: ApiHandler;
  workbook?: CreateWorkbookHandlerOptions;
}

export const createApiApp = ({
  assistantHandler = createAssistantHandler(),
  workbook,
}: CreateApiAppOptions = {}) => {
  const app = new Hono();
  const workbookHandler = createWorkbookHandler(workbook);

  app.all("/api/assistant", (context) => assistantHandler(context.req.raw));
  app.all("/api/workbook", (context) => workbookHandler(context.req.raw));
  app.all("/api/*", (context) =>
    context.json({ error: "API route not found." }, 404),
  );

  return app;
};
