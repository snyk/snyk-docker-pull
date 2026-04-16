import { types } from "@snyk/docker-registry-v2-client";

/**
 * Directory Result.
 */
export interface DirResult {
  /**
   * Container image file path.
   */
  name: string;

  /**
   * Deletes directory.
   */
  removeCallback: () => void;
}

/**
 * Docker Pull Result.
 */
export interface DockerPullResult {
  /**
   * Container image digest.
   */
  imageDigest: string;

  /**
   * Directory containing container image.
   */
  stagingDir: DirResult | null;

  /**
   *  @deprecated caching is no longer used.
   */
  cachedLayersDigests: string[];

  /**
   * Downloaded layers digests.
   */
  missingLayersDigests: string[];

  /**
   * Pull duration in milliseconds.
   */
  pullDuration: number;

  /**
   * Optional for backwards compatibility. This field is not directly returned by the container registry,
   * it is appended before returning the ImageManifest.
   * It is only applicable to multi-platform images.
   */
  indexDigest?: string;

  /**
   * Optional for backwards compatibility. This field is not directly returned by the container registry,
   * it is appended before returning the ImageManifest.
   */
  manifestDigest?: string;
}

/**
 * Docker Pull Options.
 */
export interface DockerPullOptions {
  /**
   * Container Registry username.
   */
  username?: string;

  /**
   * Container Registry password.
   */
  password?: string;

  /**
   * Additional request options to be passed to the container registry client.
   */
  reqOptions?: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  /**
   * Load the image into the Docker container runtime. Default: `true`.
   *
   * After image has been loaded, the staging directory is automatically deleted.
   */
  loadImage?: boolean;

  /**
   * Directory where image is persisted.
   *
   * Replaces `DirResult` `removeCallback` with a noop.
   */
  imageSavePath?: string;

  /**
   * Directory where image is persisted.
   *
   * Default: operating system's tmp directory.
   */
  stagingDirPath?: string;

  /**
   * Set platform if server is multi-platform capable.
   */
  platform?: types.Platform;

  /**
   * Optional observer to receive events from the container registry client.
   */
  observer?: types.ContainerRegistryClientObserver;
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
