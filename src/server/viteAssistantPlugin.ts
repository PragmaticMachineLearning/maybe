import { Readable } from "node:stream";
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import type { Plugin } from "vite";

import { createAssistantHandler } from "./assistantRoute";
import { createInMemoryWorkbookRepository } from "./inMemoryWorkbookRepository";
import { createWorkbookHandler } from "./workbookRoute";

interface RequestInitWithDuplex extends RequestInit {
  duplex?: "half";
}

interface AssistantApiPluginOptions {
  getApiKey?: () => string | undefined;
}

const assistantPath = "/api/assistant";
const workbookPath = "/api/workbook";

const buildHeaders = (headers: IncomingHttpHeaders): Headers => {
  const webHeaders = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        webHeaders.append(name, item);
      }
      continue;
    }

    webHeaders.set(name, value);
  }

  return webHeaders;
};

const getRequestUrl = (request: IncomingMessage): string => {
  const host = request.headers.host ?? "localhost";
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProtocol === "string"
      ? forwardedProtocol
      : request.socket instanceof Object && "encrypted" in request.socket
        ? "https"
        : "http";
  const originalUrl =
    (request as IncomingMessage & { originalUrl?: string }).originalUrl ??
    request.url ??
    assistantPath;

  return `${protocol}://${host}${originalUrl}`;
};

const toWebRequest = (request: IncomingMessage): Request => {
  const init: RequestInitWithDuplex = {
    method: request.method,
    headers: buildHeaders(request.headers),
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = Readable.toWeb(request) as ReadableStream<Uint8Array>;
    init.duplex = "half";
  }

  return new Request(getRequestUrl(request), init);
};

const writeWebResponse = async (
  webResponse: Response,
  serverResponse: ServerResponse,
): Promise<void> => {
  serverResponse.statusCode = webResponse.status;
  serverResponse.statusMessage = webResponse.statusText;
  webResponse.headers.forEach((value, name) => {
    serverResponse.setHeader(name, value);
  });

  if (!webResponse.body) {
    serverResponse.end();
    return;
  }

  const reader = webResponse.body.getReader();

  try {
    while (true) {
      if (serverResponse.destroyed || serverResponse.writableEnded) {
        await reader.cancel();
        return;
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!serverResponse.write(value)) {
        await waitForDrain(serverResponse, reader);
      }
    }

    if (!serverResponse.destroyed && !serverResponse.writableEnded) {
      serverResponse.end();
    }
  } finally {
    reader.releaseLock();
  }
};

const waitForDrain = async (
  serverResponse: ServerResponse,
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> => {
  if (serverResponse.destroyed || serverResponse.writableEnded) {
    await reader.cancel();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      serverResponse.off("drain", handleDrain);
      serverResponse.off("close", handleClose);
      serverResponse.off("error", handleError);
    };
    const handleDrain = (): void => {
      cleanup();
      resolve();
    };
    const handleClose = (): void => {
      cleanup();
      reject(new Error("Response closed before drain."));
    };
    const handleError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    serverResponse.once("drain", handleDrain);
    serverResponse.once("close", handleClose);
    serverResponse.once("error", handleError);
  }).catch(async (error: unknown) => {
    await reader.cancel(error);
    throw error;
  });
};

const writeMiddlewareError = (
  error: unknown,
  serverResponse: ServerResponse,
): void => {
  console.error("Vite API middleware failed", error);

  if (serverResponse.headersSent) {
    serverResponse.destroy(error instanceof Error ? error : undefined);
    return;
  }

  serverResponse.statusCode = 500;
  serverResponse.setHeader("content-type", "application/json");
  serverResponse.end(JSON.stringify({ error: "Vite API middleware failed." }));
};

const createApiMiddleware =
  (
    handleRequest: (request: Request) => Promise<Response>,
  ): ((request: IncomingMessage, response: ServerResponse) => void) =>
  (request, response) => {
    void (async () => {
      try {
        const webRequest = toWebRequest(request);
        const webResponse = await handleRequest(webRequest);
        await writeWebResponse(webResponse, response);
      } catch (error) {
        writeMiddlewareError(error, response);
      }
    })();
  };

export const assistantApiPlugin = ({
  getApiKey,
}: AssistantApiPluginOptions = {}): Plugin => {
  const handleAssistantRequest = createAssistantHandler({ getApiKey });
  const assistantMiddleware = createApiMiddleware(handleAssistantRequest);

  return {
    name: "maybe-assistant-api",
    configureServer(server) {
      server.middlewares.use(assistantPath, assistantMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(assistantPath, assistantMiddleware);
    },
  };
};

export const workbookApiPlugin = (): Plugin => {
  const workbookRepository = createInMemoryWorkbookRepository();
  const handleWorkbookRequest = createWorkbookHandler({
    repository: workbookRepository,
  });
  const workbookMiddleware = createApiMiddleware(handleWorkbookRequest);

  return {
    name: "maybe-workbook-api",
    configureServer(server) {
      server.middlewares.use(workbookPath, workbookMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(workbookPath, workbookMiddleware);
    },
  };
};
