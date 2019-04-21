import * as fs from "fs";
import * as path from "path";

import { Digest } from "../common/types";
import { promiseWrite, readFile, unlink } from "../common/utils";

const MAX_SIZE = 100;

export interface LayerUsage {
  digest: Digest;
  count: number;
}

export class LayersCache {
  private sortedLayersUsage: LayerUsage[];

  constructor(private dirPath: string, private maxSize: number = MAX_SIZE) {
    this.sortedLayersUsage = [];
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath);
      return;
    }
    const digests: Digest[] = fs.readdirSync(this.dirPath);
    for (const digest of digests) {
      this.sortedLayersUsage.push({
        digest,
        count: 1
      });
    }
  }

  private get size(): number {
    return fs.readdirSync(this.dirPath).length;
  }

  public async refreshCache(digests: Digest[]): Promise<void> {
    for (const digest of digests) {
      let layerUsage: LayerUsage | undefined = this.sortedLayersUsage.find(
        u => u.digest === digest
      );
      if (!layerUsage) {
        layerUsage = { digest, count: 0 };
        this.sortedLayersUsage.unshift(layerUsage);
      }
      layerUsage.count++;
    }
    this.sortedLayersUsage.sort((u0, u1) => u0.count - u1.count);
    const excess = Math.max(0, this.size - this.maxSize);
    const exceesDigests: Digest[] = [];
    for (let i = 0; i < excess; i++) {
      exceesDigests.push(this.sortedLayersUsage[i].digest);
    }
    await Promise.all(exceesDigests.map(digest => this.removeLayer(digest)));
    // TODO: log
  }

  public async saveLayer(digest: Digest, blob: Buffer): Promise<void> {
    const layerPath = path.join(this.dirPath, digest);
    if (fs.existsSync(layerPath)) {
      return;
    }
    await promiseWrite(layerPath, blob);
  }

  public async getLayer(digest: Digest): Promise<Buffer> {
    try {
      return await readFile(path.join(this.dirPath, digest));
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
      return Buffer.alloc(0);
    }
  }

  private async removeLayer(digest: Digest) {
    try {
      await unlink(path.join(this.dirPath, digest));
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
      // TODO(leon): log
    }
  }
}
