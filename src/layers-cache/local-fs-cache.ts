import * as fs from "fs";
import * as path from "path";

import {
  Digest,
  Layer,
  LayerConfig,
  promiseWrite,
  readDir,
  readFile,
  unlink
} from "../common";
import { LayersCache } from "./layers-cache";

export class LocalFSCache extends LayersCache {
  constructor(private dirPath: string, maxSize?: number) {
    super(maxSize);
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath);
      return;
    }
    const digests: Digest[] = fs.readdirSync(this.dirPath);
    for (const digest of digests) {
      this.sortedLayersUsage.push({
        digest,
        orgs: new Set<string>()
      });
    }
  }

  get size(): number {
    return fs.readdirSync(this.dirPath).length;
  }

  public async saveLayers(layers: Layer[]): Promise<void> {
    for (const layer of layers) {
      const layerPath = path.join(this.dirPath, layer.config.digest);
      if (fs.existsSync(layerPath)) {
        continue;
      }
      await promiseWrite(layerPath, layer.blob);
    }
  }

  public async getLayers(configs: LayerConfig[]): Promise<Layer[]> {
    const digests: Set<string> = new Set<string>(await readDir(this.dirPath));
    const layers: Layer[] = [];
    for (const config of configs) {
      if (digests.has(config.digest)) {
        try {
          layers.push({
            blob: await readFile(path.join(this.dirPath, config.digest)),
            config
          });
        } catch (err) {
          if (err.code !== "ENOENT") {
            throw err;
          }
        }
      }
    }
    return layers;
  }

  protected async removeLayers(digests: Digest[]): Promise<void> {
    await Promise.all(digests.map(digest => this.removeLayer(digest)));
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
