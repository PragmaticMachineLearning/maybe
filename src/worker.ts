import type { AnyD1Database } from "drizzle-orm/d1";

import { createAssistantHandler } from "./server/assistantRoute";
import { createD1WorkbookRepository } from "./server/workbookRepository";
import { createWorkbookHandler } from "./server/workbookRoute";

interface WorkerEnv {
  ASSETS: {
    fetch: (request: Request) => Promise<Response> | Response;
  };
  DB?: AnyD1Database;
  OPENAI_API_KEY?: string;
}

const assistantPath = "/api/assistant";
const workbookPath = "/api/workbook";

const createRuntimeAssistantHandler = (env: WorkerEnv) =>
  createAssistantHandler({
    getApiKey: () => env.OPENAI_API_KEY,
  });

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> | Response {
    const url = new URL(request.url);

    if (url.pathname === assistantPath) {
      return createRuntimeAssistantHandler(env)(request);
    }

    if (url.pathname === workbookPath) {
      return createWorkbookHandler({
        repository: env.DB
          ? createD1WorkbookRepository(env.DB)
          : undefined,
      })(request);
    }

    return env.ASSETS.fetch(request);
  },
};
