import { contentTypes, types } from "@snyk/docker-registry-v2-client";
import * as registryClient from "@snyk/docker-registry-v2-client";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as tar from "tar-fs";
import { randomUUID } from "crypto";
import { promisify } from "util";
import { Layer } from "./common";
import * as subProcess from "./sub-process";
import * as tmp from "./tmp";

import {
  DockerPullOptions,
  DockerPullResult,
  SaveRequests,
  DirResult,
} from "./types";
import { InvalidManifestSchemaVersionError } from "./errors";

const readFile = promisify(fs.readFile);
const link = promisify(fs.link);
const stat = promisify(fs.stat);

const DEFAULT_LAYER_JSON = {
  created: "0001-01-01T00:00:00Z",
  container_config: {
    Hostname: "",
    Domainname: "",
    User: "",
    AttachStdin: false,
    AttachStdout: false,
    AttachStderr: false,
    Tty: false,
    OpenStdin: false,
    StdinOnce: false,
    Env: null,
    Cmd: null,
    Image: "",
    Volumes: null,
    WorkingDir: "",
    Entrypoint: null,
    OnBuild: null,
    Labels: null,
  },
};

export class DockerPull {
  private static async findDockerBinary(): Promise<string> {
    return subProcess
      .execute("which", ["docker"], undefined, undefined, true)
      .then((cmdOutput) => cmdOutput.stdout.trim())
      .catch((cmdOutput) => {
        throw new Error(cmdOutput.stderr);
      });
  }

  public async pull(
    registryBase: string,
    repo: string,
    tag: string,
    opt?: DockerPullOptions
  ): Promise<DockerPullResult> {
    const loadImage = opt?.loadImage === undefined ? true : opt.loadImage;
    const manifest: types.ImageManifest = await registryClient.getManifest(
      registryBase,
      repo,
      tag,
      opt?.username,
      opt?.password,
      opt?.reqOptions
    );

    const indexDigest = manifest.indexDigest ?? undefined;
    const manifestDigest = manifest.manifestDigest ?? undefined;

    if (manifest.schemaVersion !== 2) {
      throw new InvalidManifestSchemaVersionError(manifest.schemaVersion);
    }

    const imageConfigMetadata: types.LayerConfig = manifest.config;
    const imageConfig = await registryClient.getImageConfig(
      registryBase,
      repo,
      imageConfigMetadata.digest,
      opt?.username,
      opt?.password,
      opt?.reqOptions
    );
    const t0 = Date.now();
    const layersConfigs: types.LayerConfig[] = manifest.layers;

    const stagingDirPath = opt.stagingDirPath
      ? opt.stagingDirPath
      : os.tmpdir();

    const blobDir = tmp.dirSync({ path: stagingDirPath });

    const missingLayers = await this.downloadLayers(
      blobDir,
      layersConfigs,
      registryBase,
      repo,
      opt?.username,
      opt?.password,
      opt?.reqOptions
    );
    const pullDuration = Date.now() - t0;

    let imageDigest: string;
    const stagingDir: DirResult = this.createDownloadedImageDestination(
      stagingDirPath,
      opt?.imageSavePath
    );

    try {
      if (manifest?.manifestContentType === contentTypes.OCI_MANIFEST_V1) {
        await this.buildOCIImage(
          imageConfigMetadata.digest,
          manifest,
          imageConfig,
          missingLayers,
          blobDir,
          stagingDir
        );
      } else {
        await this.buildImage(
          imageConfigMetadata.digest,
          imageConfig,
          layersConfigs,
          missingLayers,
          blobDir,
          stagingDir
        );
      }

      if (loadImage) {
        imageDigest = await this.loadImage(registryBase, repo, tag, stagingDir);
      }
    } catch (err) {
      throw new Error(err.stderr);
    } finally {
      try {
        // Check is the image should be saved for debugging
        const saveMatcher = {
          ...opt,
          registryBase,
          repo,
          tag,
        };
        for (const [name, requestMatcher] of Object.entries(
          await this.saveRequests()
        )) {
          if (
            Object.keys(requestMatcher).every(
              (key) => requestMatcher[key] === saveMatcher[key]
            )
          ) {
            await link(
              path.join(stagingDir.name, "image.tar"),
              path.join(stagingDirPath, `${name}-${randomUUID()}.tar`)
            );
            break;
          }
        }
      } catch (err) {
        console.error("pullSaveRequest error: ", err);
      }

      blobDir.removeCallback();
      if (loadImage) {
        stagingDir.removeCallback();
      }
    }

    return {
      imageDigest,
      stagingDir: loadImage ? null : stagingDir,
      cachedLayersDigests: [],
      missingLayersDigests: missingLayers.map((layer) => layer.config.digest),
      pullDuration,
      indexDigest,
      manifestDigest,
    };
  }

  private async downloadLayers(
    blobDir: DirResult,
    layersConfigs: types.LayerConfig[],
    registryBase,
    repo: string,
    username?: string,
    password?: string,
    // weak typing on the client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reqOptions = {} as any
  ): Promise<Layer[]> {
    return await Promise.all(
      layersConfigs.map(async (config: types.LayerConfig) => {
        const blobName = crypto.randomUUID();
        await registryClient.downloadLayer(
          path.join(blobDir.name, blobName),
          registryBase,
          repo,
          config.digest,
          username,
          password,
          reqOptions
        );
        return { config, blobName };
      })
    );
  }

  private async saveRequests(): Promise<SaveRequests> {
    const saveRequestsPath = path.join(os.tmpdir(), "pullSaveRequest.json");
    try {
      if (await stat(saveRequestsPath)) {
        return JSON.parse((await readFile(saveRequestsPath)).toString("utf-8"));
      }
    } catch (err) {
      return {};
    }
  }

  private async buildOCIImage(
    imageDigest: string,
    manifest: types.ImageManifest,
    imageConfig: Record<string, unknown>,
    layers: Layer[],
    blobDir: DirResult,
    stagingDir: DirResult
  ): Promise<string> {
    const pack = tar.pack(blobDir.name, {
      // write layers
      entries: layers.map((layer) => layer.blobName),
      map(header) {
        const layer = layers.find((layer) => layer.blobName == header.name);
        const digest = layer.config.digest.replace("sha256:", "");
        header.name = path.join("blobs", "sha256", digest);
        return header;
      },
      finalize: false,
      finish(pack) {
        const configContent = JSON.stringify(imageConfig);
        const configDigest = imageDigest.replace("sha256:", "");
        pack.entry(
          { name: path.join("blobs", "sha256", configDigest) },
          configContent
        );

        // Ensure config digest and size is accurate following serialization round trip
        manifest.config.digest = `sha256:${configDigest}`;
        manifest.config.size = Buffer.byteLength(configContent, "utf8");

        // Unset properties added by docker-registry-v2-client
        manifest.indexDigest = undefined;
        manifest.manifestDigest = undefined;
        manifest.manifestContentType = undefined;

        const manifestContent = JSON.stringify(manifest);
        const manifestDigest = crypto
          .createHash("sha256")
          .update(manifestContent)
          .digest("hex")
          .toLowerCase();
        pack.entry(
          { name: path.join("blobs", "sha256", manifestDigest) },
          manifestContent
        );

        const indexContent = JSON.stringify({
          schemaVersion: 2,
          mediaType: contentTypes.OCI_INDEX_V1,
          manifests: [
            {
              mediaType: contentTypes.OCI_MANIFEST_V1,
              size: Buffer.byteLength(manifestContent, "utf8"),
              digest: `sha256:${manifestDigest}`,
            },
          ],
        });
        pack.entry({ name: "index.json" }, indexContent);

        const ociLayoutContent = JSON.stringify({
          imageLayoutVersion: "1.0.0",
        });
        pack.entry({ name: "oci-layout" }, ociLayoutContent, () => {
          pack.finalize();
        });
      },
    });

    const imagePath = path.join(stagingDir.name, "image.tar");
    const file = fs.createWriteStream(imagePath);
    pack.pipe(file);

    return new Promise((resolve, reject) => {
      file.on("close", () => resolve(path.join(imagePath)));
      file.on("error", (err) => reject(err));
    });
  }

  private async buildImage(
    imageDigest: string,
    imageConfig: Record<string, unknown>,
    layersConfigs: types.LayerConfig[],
    layers: Layer[],
    blobDir: DirResult,
    stagingDir: DirResult
  ): Promise<string> {
    // generate layer metadata
    let parentDigest: string | undefined;
    const layerMetadata: Record<string, { version: string; json: string }> = {};
    for (const layerConfig of layersConfigs) {
      const digest = layerConfig.digest.replace("sha256:", "");
      let json: Record<string, unknown> = Object.assign(
        {},
        { id: digest },
        DEFAULT_LAYER_JSON
      );
      if (parentDigest) {
        json = Object.assign({ parent: parentDigest });
      }
      parentDigest = digest;
      layerMetadata[digest] = {
        json: JSON.stringify(json),
        version: "1.0",
      };
    }

    const pack = tar.pack(blobDir.name, {
      // write layers
      entries: layers.map((layer) => layer.blobName),
      map(header) {
        const layer = layers.find((layer) => layer.blobName === header.name);
        const digest = layer.config.digest.replace("sha256:", "");
        header.name = path.join(digest, "layer.tar");
        return header;
      },
      finalize: false,
      finish(pack) {
        // write layer metadata
        for (const digest of Object.keys(layerMetadata)) {
          const metadata = layerMetadata[digest];
          pack.entry({ name: path.join(digest, "json") }, metadata.json);
          pack.entry({ name: path.join(digest, "VERSION") }, metadata.version);
        }

        imageDigest = imageDigest.replace("sha256:", "");

        // write image json
        pack.entry(
          { name: `${imageDigest}.json` },
          JSON.stringify(imageConfig)
        );

        // write manifest.json
        const manifestJson = [
          {
            Config: `${imageDigest}.json`,
            RepoTags: null,
            Layers: layersConfigs.map(
              (config) => `${config.digest.replace("sha256:", "")}/layer.tar`
            ),
          },
        ];
        pack.entry(
          { name: "manifest.json" },
          JSON.stringify(manifestJson),
          () => {
            pack.finalize();
          }
        );
      },
    });

    const imagePath = path.join(stagingDir.name, "image.tar");
    const file = fs.createWriteStream(imagePath);
    pack.pipe(file);

    return new Promise((resolve, reject) => {
      file.on("close", () => resolve(path.join(imagePath)));
      file.on("error", (err) => reject(err));
    });
  }

  private async loadImage(
    registryBase: string,
    repo: string,
    tag: string,
    stagingDir: DirResult
  ): Promise<string> {
    const dockerBinary: string = await DockerPull.findDockerBinary();
    const stdout = (
      await subProcess.execute(
        dockerBinary,
        ["load", "-i", "image.tar"],
        stagingDir.name
      )
    ).stdout;
    // Loaded image ID: sha256:36456e9e9cb7c4b17d97461a5aeb062a481401e3d2b559285c7083d8e7f8efa6
    const imgDigest: string = stdout.split("sha256:")[1].trim();
    await subProcess.execute(dockerBinary, [
      "tag",
      `${imgDigest}`,
      `${registryBase}/${repo}:${tag}`,
    ]);

    return imgDigest;
  }

  private createDownloadedImageDestination(
    stagingDirPath: string,
    imageSavePath: string | undefined
  ): DirResult {
    if (!imageSavePath) {
      return tmp.dirSync({ path: stagingDirPath });
    }

    return {
      name: imageSavePath,
      removeCallback: (): void => {
        /* do nothing */
      },
    };
  }
}
