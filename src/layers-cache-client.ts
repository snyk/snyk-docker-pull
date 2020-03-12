import { types } from "@snyk/docker-registry-v2-client";
import * as needle from "needle";
import { Layer } from "./common";
import { NeedleResponse } from "needle";

export class LayersCacheClient {
  constructor(private hostname: string) {}

  public async saveLayers(layers: Layer[]): Promise<void> {
    for (const layer of layers) {
      const resp = await needle(
        "post",
        `${this.hostname}/save-layer`,
        layer.blob,
        {
          headers: {
            "Content-Type": "application/octet-stream",
            digest: layer.config.digest
          }
        }
      );

      throwIfNot2xx(resp);
    }
  }

  public async getLayers(configs: types.LayerConfig[]): Promise<Layer[]> {
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

  private async getBlob(digest: string): Promise<Buffer> {
    const resp = await needle("get", `${this.hostname}/get-layer`, {
      headers: {
        digest
      }
    });

    throwIfNot2xx(resp);

    return resp.body;
  }
}

function throwIfNot2xx(resp: NeedleResponse): void {
  if (resp.statusCode >= 200 && resp.statusCode <= 299) {
    return;
  }

  let err: any = new Error(`http request failed: ${resp.statusCode}`);
  err.statusCode = resp.statusCode;
  err.error = resp.body;
  throw err;
}
