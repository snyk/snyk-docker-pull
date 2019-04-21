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

export type AnyJson = boolean | number | string | null | JsonArray | JsonMap;
export interface JsonArray extends Array<AnyJson> {}
export interface JsonMap {
  [key: string]: AnyJson | undefined;
}