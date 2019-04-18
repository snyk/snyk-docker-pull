import { Digest, Layer, LayerConfig } from "../common";
import { LocalFSCache } from "./local-fs-cache";

export class LocalFSCacheRO extends LocalFSCache {
  public async refreshCache(
    org: string,
    layerConfigs: LayerConfig[]
  ): Promise<void> {
    return new Promise(resolve => resolve());
  }
  public async saveLayers(layers: Layer[]): Promise<void> {
    return new Promise(resolve => resolve());
  }
  protected async removeLayers(digests: Digest[]): Promise<void> {
    return new Promise(resolve => resolve());
  }
}
