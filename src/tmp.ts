import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { DirResult } from "./types";

/**
 * Creates a temporary directory.
 */
export function dirSync(options?: { path?: string }): DirResult {
  const name = fs.mkdtempSync(`${options?.path ?? os.tmpdir()}${path.sep}`);
  return {
    name,
    removeCallback(): void {
      fs.rmSync(name, { recursive: true });
    },
  };
}
