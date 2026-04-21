import { Readable } from "node:stream";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import { handleAssistantRequest } from "./assistantRoute";

interface RequestInitWithDuplex extends RequestInit {
  duplex?: "half";
}

const assistantPath = "/api/assistant";

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
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!serverResponse.write(value)) {
        await new Promise<void>((resolve) => {
          serverResponse.once("drain", resolve);
        });
      }
    }

    serverResponse.end();
  } finally {
    reader.releaseLock();
  }
};

const writeMiddlewareError = (
  error: unknown,
  serverResponse: ServerResponse,
): void => {
  console.error("Assistant middleware failed", error);

  if (serverResponse.headersSent) {
    serverResponse.destroy(error instanceof Error ? error : undefined);
    return;
  }

  serverResponse.statusCode = 500;
  serverResponse.setHeader("content-type", "application/json");
  serverResponse.end(JSON.stringify({ error: "Assistant middleware failed." }));
};

const assistantMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  void (async () => {
    try {
      const webRequest = toWebRequest(request);
      const webResponse = await handleAssistantRequest(webRequest);
      await writeWebResponse(webResponse, response);
    } catch (error) {
      writeMiddlewareError(error, response);
    }
  })();
};

export const assistantApiPlugin = (): Plugin => ({
  name: "maybe-assistant-api",
  configureServer(server) {
    server.middlewares.use(assistantPath, assistantMiddleware);
  },
  configurePreviewServer(server) {
    server.middlewares.use(assistantPath, assistantMiddleware);
  },
});
