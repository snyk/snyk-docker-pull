import * as request from "request-promise-native";

import { Digest, Layer, LayerConfig } from "./common";

export class LayersCacheClient {
  constructor(private hostname: string) {}

  public async saveLayers(layers: Layer[]): Promise<void> {
    for (const layer of layers) {
      await request({
        uri: `${this.hostname}/save-layer`,
        method: "POST",
        body: layer.blob,
        headers: {
          type: "application/octet-stream",
          digest: layer.config.digest
        }
      });
    }
  }

  public async getLayers(configs: LayerConfig[]): Promise<Layer[]> {
    const result: Layer[] = [];
    for (const config of configs) {
      const blob = await this.getBlob(config.digest);
      if (blob.length === 0) {
        continue;
      }
      result.push({ config, blob });
    }
    return result;
  }

  private async getBlob(digest: Digest): Promise<Buffer> {
    return await request({
      uri: `${this.hostname}/get-layer`,
      method: "GET",
      encoding: null
    });
  }
}
