import { types } from "@snyk/docker-registry-v2-client";

export interface DirResult {
  name: string;
  removeCallback: () => void;
}

export interface DockerPullResult {
  imageDigest: string;
  stagingDir: DirResult | null;
  /** @deprecated caching is no longer used */
  cachedLayersDigests: string[];
  // The digests of the missing layers as returned in the manifest
  missingLayersDigests: string[];
  pullDuration: number;
  indexDigest?: string;
  manifestDigest?: string;
}

export interface DockerPullOptions {
  username?: string;
  password?: string;
  // weak typing on the client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reqOptions?: any;
  /**
   * loadImage will default to true if no value is sent
   */
  loadImage?: boolean;
  imageSavePath?: string;
  stagingDirPath?: string;
  platform?: types.Platform;
}

export interface SaveRequests {
  [name: string]: SaveRequest;
}

interface SaveRequest {
  username?: string;
  registryBase?: string;
  repo?: string;
  tag?: string;
}
