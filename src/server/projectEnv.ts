import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const parseEnvLine = (line: string): [string, string] | null => {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmedLine.indexOf("=");
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmedLine.slice(0, separatorIndex).trim();
  const value = trimmedLine.slice(separatorIndex + 1).trim();

  if (!key) {
    return null;
  }

  return [key, removeWrappingQuotes(value)];
};

const removeWrappingQuotes = (value: string): string => {
  const quote = value[0];
  const hasMatchingQuotes =
    value.length >= 2 &&
    (quote === "'" || quote === '"') &&
    value[value.length - 1] === quote;

  return hasMatchingQuotes ? value.slice(1, -1) : value;
};

const readProjectEnv = (projectRoot: string): Record<string, string> => {
  const envPath = join(projectRoot, ".env");

  if (!existsSync(envPath)) {
    return {};
  }

  const env: Record<string, string> = {};
  const envFile = readFileSync(envPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const parsedLine = parseEnvLine(line);
    if (parsedLine === null) {
      continue;
    }

    const [key, value] = parsedLine;
    env[key] = value;
  }

  return env;
};

export const getProjectEnvValue = (
  key: string,
  projectRoot: string = process.cwd(),
): string | undefined => {
  const projectEnv = readProjectEnv(projectRoot);

  if (Object.prototype.hasOwnProperty.call(projectEnv, key)) {
    return projectEnv[key];
  }

  return process.env[key];
};
