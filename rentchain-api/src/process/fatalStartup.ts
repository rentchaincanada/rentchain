type FatalKind = "uncaughtException" | "unhandledRejection" | "bootstrap";

type FatalProcess = Pick<NodeJS.Process, "on"> & {
  exitCode?: string | number;
};

type FatalLogger = (message: string, error: unknown) => void;

export function createFatalStartupHandler(
  processLike: FatalProcess = process,
  log: FatalLogger = console.error,
) {
  let handled = false;

  return (kind: FatalKind, error: unknown): void => {
    if (handled) return;
    handled = true;

    // Set the failure status before logging so logger failures cannot turn a
    // fatal startup error into a successful process exit.
    processLike.exitCode = 1;
    log(`[FATAL] ${kind}`, error);
  };
}

export function installFatalStartupHandlers(
  processLike: FatalProcess = process,
  log: FatalLogger = console.error,
): void {
  const fatal = createFatalStartupHandler(processLike, log);
  processLike.on("uncaughtException", (error) => fatal("uncaughtException", error));
  processLike.on("unhandledRejection", (error) => fatal("unhandledRejection", error));
}
