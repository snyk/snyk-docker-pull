export class InvalidManifestSchemaVersionError extends Error {
  constructor(version: number) {
    super(`Invalid manifest schema version ${version}`);
  }
}
