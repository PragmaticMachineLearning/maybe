interface ManagedProcess {
  name: string;
  process: Bun.Subprocess;
}

const apiPort = process.env.MAYBE_API_PORT ?? process.env.PORT ?? "3000";
const clientPort = process.env.MAYBE_CLIENT_PORT ?? "5173";
const apiOrigin = `http://localhost:${apiPort}`;

const processes: ManagedProcess[] = [];

const spawnManagedProcess = (
  name: string,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): void => {
  const childProcess = Bun.spawn([command, ...args], {
    env,
    stdout: "inherit",
    stderr: "inherit",
    onExit(_subprocess, code, signal) {
      if (isShuttingDown) {
        return;
      }

      console.error(`${name} exited`, { code, signal });
      shutdown(code ?? 1);
    },
  });

  processes.push({ name, process: childProcess });
};

let isShuttingDown = false;

const shutdown = (exitCode = 0): void => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  for (const managedProcess of processes) {
    managedProcess.process.kill("SIGTERM");
  }

  process.exit(exitCode);
};

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

spawnManagedProcess("api", "bun", ["run", "src/server/index.ts"], {
  ...process.env,
  MAYBE_SERVE_STATIC: "false",
  PORT: apiPort,
});

spawnManagedProcess("vite", "bunx", ["vite", "--host", "0.0.0.0", "--port", clientPort], {
  ...process.env,
  MAYBE_API_ORIGIN: apiOrigin,
});

console.log(`Maybe API listening on ${apiOrigin}`);
console.log(`Maybe client listening on http://localhost:${clientPort}`);
