import * as fs from "fs";
import { promisify } from "util";

export type Digest = string;
export interface LayerConfig {
  mediaType: string;
  size: number;
  digest: Digest;
}
export interface Layer {
  config: LayerConfig;
  blob: Buffer;
}

export const readDir = promisify(fs.readdir);
export const readFile = promisify(fs.readFile);
export const unlink = promisify(fs.unlink);

export function promiseWrite(filePath: string, buff: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    file.write(buff);
    file.end();
    file.on("finish", () => {
      resolve();
    });
    file.on("error", reject);
  });
}
