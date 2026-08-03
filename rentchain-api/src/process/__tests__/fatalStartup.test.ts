import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createFatalStartupHandler, installFatalStartupHandlers } from "../fatalStartup";

class FakeProcess extends EventEmitter {
  exitCode: string | number | undefined;
}

describe("fatal startup handling", () => {
  it("sets a nonzero exit status and preserves the original error", () => {
    const processLike = new FakeProcess();
    const log = vi.fn();
    const error = new Error("startup failed");

    createFatalStartupHandler(processLike, log)("bootstrap", error);

    expect(processLike.exitCode).toBe(1);
    expect(log).toHaveBeenCalledWith("[FATAL] bootstrap", error);
    expect(error.stack).toContain("startup failed");
  });

  it("overrides a prior success status and executes only once", () => {
    const processLike = new FakeProcess();
    processLike.exitCode = 0;
    const log = vi.fn();
    const fatal = createFatalStartupHandler(processLike, log);

    fatal("uncaughtException", new Error("first"));
    fatal("unhandledRejection", new Error("second"));

    expect(processLike.exitCode).toBe(1);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("sets failure before logging even when the logger throws", () => {
    const processLike = new FakeProcess();
    const fatal = createFatalStartupHandler(processLike, () => {
      throw new Error("logger failure");
    });

    expect(() => fatal("bootstrap", new Error("startup failed"))).toThrow("logger failure");
    expect(processLike.exitCode).toBe(1);
  });

  it("routes uncaught exceptions and rejections through one fatal path", () => {
    const processLike = new FakeProcess();
    const log = vi.fn();
    installFatalStartupHandlers(processLike, log);

    const original = new Error("configuration failure");
    processLike.emit("uncaughtException", original);
    processLike.emit("unhandledRejection", new Error("later failure"));

    expect(processLike.exitCode).toBe(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("[FATAL] uncaughtException", original);
  });

  it("does not alter normal process status before a fatal event", () => {
    const processLike = new FakeProcess();
    installFatalStartupHandlers(processLike, vi.fn());
    expect(processLike.exitCode).toBeUndefined();
  });
});
