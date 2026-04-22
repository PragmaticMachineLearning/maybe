import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getProjectEnvValue } from "./projectEnv";

const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
let tempDirectories: string[] = [];

const createTempProject = (): string => {
  const projectPath = mkdtempSync(join(tmpdir(), "maybe-env-test-"));
  tempDirectories.push(projectPath);
  return projectPath;
};

describe("project env", () => {
  afterEach(() => {
    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }

    for (const tempDirectory of tempDirectories) {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
    tempDirectories = [];
  });

  it("uses .env before the system-wide environment", () => {
    const projectPath = createTempProject();
    writeFileSync(join(projectPath, ".env"), "OPENAI_API_KEY=sk-project\n");
    process.env.OPENAI_API_KEY = "sk-system";

    expect(getProjectEnvValue("OPENAI_API_KEY", projectPath)).toBe(
      "sk-project",
    );
  });

  it("falls back to the system-wide environment when .env is missing", () => {
    const projectPath = createTempProject();
    process.env.OPENAI_API_KEY = "sk-system";

    expect(getProjectEnvValue("OPENAI_API_KEY", projectPath)).toBe(
      "sk-system",
    );
  });

  it("falls back to the system-wide environment when .env has no matching key", () => {
    const projectPath = createTempProject();
    writeFileSync(join(projectPath, ".env"), "OTHER_KEY=value\n");
    process.env.OPENAI_API_KEY = "sk-system";

    expect(getProjectEnvValue("OPENAI_API_KEY", projectPath)).toBe(
      "sk-system",
    );
  });

  it("ignores nested .env files outside the project root", () => {
    const projectPath = createTempProject();
    const nestedPath = join(projectPath, "src");
    mkdirSync(nestedPath);
    writeFileSync(join(nestedPath, ".env"), "OPENAI_API_KEY=sk-nested\n");
    delete process.env.OPENAI_API_KEY;

    expect(getProjectEnvValue("OPENAI_API_KEY", projectPath)).toBeUndefined();
  });
});
