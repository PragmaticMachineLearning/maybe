import { z } from "zod";

import type { SerializedCellContent } from "../assistant/workbookSnapshot";

const workspaceCookieName = "maybe_workspace";
const defaultWorkbookTitle = "Untitled workbook";

const serializedCellContentSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const saveWorkbookRequestSchema = z.object({
  serializedContent: z.array(z.array(serializedCellContentSchema)),
});

type SerializedWorkbookContent = SerializedCellContent[][];

export interface SavedWorkbook {
  id: string;
  workspaceId: string;
  title: string;
  serializedContent: SerializedWorkbookContent;
  updatedAt: string;
}

export interface WorkbookRepository {
  ensureWorkspace: (workspaceId: string, now: Date) => Promise<void>;
  getDefaultWorkbook: (workspaceId: string) => Promise<SavedWorkbook | null>;
  saveDefaultWorkbook: (input: SavedWorkbook) => Promise<SavedWorkbook>;
}

interface CreateWorkbookHandlerOptions {
  repository?: WorkbookRepository;
  createWorkspaceId?: () => string;
  now?: () => Date;
}

const jsonResponse = (
  body: unknown,
  status: number,
  headers?: Headers,
): Response => Response.json(body, { status, headers });

const invalidRequestResponse = (): Response =>
  jsonResponse({ error: "Invalid workbook request." }, 400);

const persistenceFailureResponse = (error: unknown): Response => {
  console.error("Workbook persistence failed", error);
  return jsonResponse({ error: "Workbook persistence failed." }, 500);
};

const getCookieValue = (cookieHeader: string | null, name: string) => {
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");
    if (cookieName === name) {
      return valueParts.join("=");
    }
  }

  return null;
};

const isValidWorkspaceId = (workspaceId: string): boolean =>
  /^[A-Za-z0-9_-]{8,128}$/.test(workspaceId);

const getWorkspaceId = (
  request: Request,
  createWorkspaceId: () => string,
): { workspaceId: string; isNew: boolean } => {
  const cookieWorkspaceId = getCookieValue(
    request.headers.get("cookie"),
    workspaceCookieName,
  );

  if (cookieWorkspaceId && isValidWorkspaceId(cookieWorkspaceId)) {
    return { workspaceId: cookieWorkspaceId, isNew: false };
  }

  return { workspaceId: createWorkspaceId(), isNew: true };
};

const createWorkspaceCookie = (request: Request, workspaceId: string): string => {
  const isHttps = new URL(request.url).protocol === "https:";
  const secureAttribute = isHttps ? "; Secure" : "";

  return [
    `${workspaceCookieName}=${workspaceId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=31536000",
    secureAttribute,
  ]
    .filter(Boolean)
    .join("; ");
};

const createResponseHeaders = (
  request: Request,
  workspaceId: string,
  shouldSetCookie: boolean,
): Headers => {
  const headers = new Headers();

  if (shouldSetCookie) {
    headers.set("set-cookie", createWorkspaceCookie(request, workspaceId));
  }

  return headers;
};

const getRepository = (
  repository: WorkbookRepository | undefined,
): WorkbookRepository | null => repository ?? null;

const getDefaultWorkbookId = (workspaceId: string): string =>
  `${workspaceId}:default`;

const parseSaveWorkbookRequest = async (
  request: Request,
): Promise<SerializedWorkbookContent | null> => {
  let parsedJson: unknown;

  try {
    parsedJson = await request.json();
  } catch {
    return null;
  }

  const result = saveWorkbookRequestSchema.safeParse(parsedJson);
  return result.success ? result.data.serializedContent : null;
};

export const createWorkbookHandler = ({
  repository,
  createWorkspaceId = () => crypto.randomUUID(),
  now = () => new Date(),
}: CreateWorkbookHandlerOptions = {}) =>
  async (request: Request): Promise<Response> => {
    if (request.method !== "GET" && request.method !== "PUT") {
      return jsonResponse(
        { error: "Workbook endpoint only supports GET and PUT." },
        405,
      );
    }

    const workbookRepository = getRepository(repository);
    if (!workbookRepository) {
      return jsonResponse(
        { error: "Workbook persistence is not configured." },
        500,
      );
    }

    const workspace = getWorkspaceId(request, createWorkspaceId);
    const headers = createResponseHeaders(
      request,
      workspace.workspaceId,
      workspace.isNew,
    );
    const requestTime = now();

    try {
      await workbookRepository.ensureWorkspace(
        workspace.workspaceId,
        requestTime,
      );

      if (request.method === "GET") {
        const workbook = await workbookRepository.getDefaultWorkbook(
          workspace.workspaceId,
        );

        return jsonResponse({ workbook }, 200, headers);
      }

      const serializedContent = await parseSaveWorkbookRequest(request);
      if (serializedContent === null) {
        return invalidRequestResponse();
      }

      const workbook = await workbookRepository.saveDefaultWorkbook({
        id: getDefaultWorkbookId(workspace.workspaceId),
        workspaceId: workspace.workspaceId,
        title: defaultWorkbookTitle,
        serializedContent,
        updatedAt: requestTime.toISOString(),
      });

      return jsonResponse({ workbook }, 200, headers);
    } catch (error) {
      return persistenceFailureResponse(error);
    }
  };
