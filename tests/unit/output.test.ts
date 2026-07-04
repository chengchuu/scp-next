import { Writable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgressReporter } from "../../src/cli/output.js";

class MemoryStream extends Writable {
  output = "";
  isTTY = true;

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.output += chunk.toString();
    callback();
  }
}

describe("CLI output", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("throttles duplicate progress updates on one terminal line", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    const stderr = new MemoryStream();
    const reporter = createProgressReporter({
      stdout: new MemoryStream(),
      stderr
    });

    reporter?.({
      operation: "upload",
      source: "./archive.tar.gz",
      destination: "/archive.tar.gz",
      currentFile: "C:\\Web\\archive.tar.gz",
      transferredBytes: 29_300_000,
      totalBytes: 591_400_000,
      percentage: 5
    });
    reporter?.({
      operation: "upload",
      source: "./archive.tar.gz",
      destination: "/archive.tar.gz",
      currentFile: "C:\\Web\\archive.tar.gz",
      transferredBytes: 29_400_000,
      totalBytes: 591_400_000,
      percentage: 5
    });

    expect(stderr.output).toBe(
      "\rUploading: C:\\Web\\archive.tar.gz 27.9 MB / 564.0 MB (5%)"
    );

    reporter?.({
      operation: "upload",
      source: "./archive.tar.gz",
      destination: "/archive.tar.gz",
      currentFile: "C:\\Web\\archive.tar.gz",
      transferredBytes: 35_500_000,
      totalBytes: 591_400_000,
      percentage: 6
    });

    expect(stderr.output).toContain(
      "\rUploading: C:\\Web\\archive.tar.gz 33.9 MB / 564.0 MB (6%)"
    );
    expect(stderr.output).not.toContain("\n");

    reporter?.({
      operation: "upload",
      source: "./archive.tar.gz",
      destination: "/archive.tar.gz",
      currentFile: "C:\\Web\\archive.tar.gz",
      transferredBytes: 591_400_000,
      totalBytes: 591_400_000,
      percentage: 100
    });

    expect(stderr.output.endsWith("\n")).toBe(true);
  });
});
