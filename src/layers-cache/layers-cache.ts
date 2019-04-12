import { Digest, Layer, LayerConfig } from "../common";

const MAX_SIZE = 100;

export interface LayerUsage {
  digest: Digest;
  orgs: Set<string>;
}

export abstract class LayersCache {
  protected sortedLayersUsage: LayerUsage[];

  constructor(private maxSize: number = MAX_SIZE) {
    this.sortedLayersUsage = [];
  }

  abstract get size(): number;

  public async refreshCache(
    org: string,
    layerConfigs: LayerConfig[]
  ): Promise<void> {
    for (const config of layerConfigs) {
      const digest = config.digest;
      let layerUsage: LayerUsage | undefined = this.sortedLayersUsage.find(
        u => u.digest === digest
      );
      if (!layerUsage) {
        layerUsage = { digest, orgs: new Set<string>() };
        this.sortedLayersUsage.unshift(layerUsage);
      }
      layerUsage.orgs.add(org);
    }
    this.sortedLayersUsage.sort((u0, u1) => u0.orgs.size - u1.orgs.size);
    const excess = Math.max(0, this.size - this.maxSize);
    const exceesDigests: Digest[] = [];
    for (let i = 0; i < excess; i++) {
      exceesDigests.push(this.sortedLayersUsage[i].digest);
    }
    await this.removeLayers(exceesDigests);
    // TODO: log
  }

  public abstract async saveLayers(layers: Layer[]): Promise<void>;
  public abstract async getLayers(configs: LayerConfig[]): Promise<Layer[]>;
  protected abstract async removeLayers(digests: Digest[]): Promise<void>;
}
