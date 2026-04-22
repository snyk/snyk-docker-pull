import type { types, ClientOptions } from "@snyk/docker-registry-v2-client";

export { DockerPull } from "./docker-pull";
export { DockerPullOptions, DockerPullResult } from "./types";
export { InvalidManifestSchemaVersionError } from "./errors";

export type { ClientOptions };
export type ContainerRegistryClientEvent = types.ContainerRegistryClientEvent;
export type ContainerRegistryClientObserver =
  types.ContainerRegistryClientObserver;
