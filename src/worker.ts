import { createAssistantHandler } from "./server/assistantRoute";

interface WorkerEnv {
  ASSETS: {
    fetch: (request: Request) => Promise<Response> | Response;
  };
  OPENAI_API_KEY?: string;
}

const assistantPath = "/api/assistant";

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

    return env.ASSETS.fetch(request);
  },
};
