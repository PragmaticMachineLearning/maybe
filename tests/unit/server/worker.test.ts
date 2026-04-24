import { describe, expect, it, vi } from "vitest";

import worker from "../../../src/worker";

const createRequest = (path: string, init?: RequestInit): Request =>
  new Request(`https://maybe.test${path}`, init);

describe("cloudflare worker entry", () => {
  it("routes assistant API requests to the assistant handler", async () => {
    const response = await worker.fetch(createRequest("/api/assistant"), {
      ASSETS: { fetch: vi.fn() },
    });

    await expect(response.json()).resolves.toEqual({
      error: "Assistant endpoint only supports POST.",
    });
    expect(response.status).toBe(405);
  });

  it("serves static assets for non-API requests", async () => {
    const assetResponse = new Response("asset");
    const assetsFetch = vi.fn(async () => assetResponse);

    const response = await worker.fetch(createRequest("/"), {
      ASSETS: { fetch: assetsFetch },
    });

    expect(response).toBe(assetResponse);
    expect(assetsFetch).toHaveBeenCalledOnce();
  });
});
