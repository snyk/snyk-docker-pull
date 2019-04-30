import * as fs from "fs";
import * as path from "path";
import * as request from "request-promise-native";
import * as tmp from "tmp";
import { Digest, Layer, LayerConfig, promiseWrite } from "./common";
import { LayersCacheClient } from "./layers-cache-client";
import * as subProcess from "./sub-process";

export interface DockerPullResult {
  imageDigest: Digest;
  cachedLayersDigests: Digest[];
  missingLayersDigests: Digest[];
  pullDuration: number;
}
export interface RegistryConfig {
  username: string;
  password: string;
  base: string;
  authBase: string;
  service: string;
}

interface Manifest {
  schemaVersion: number;
  config: LayerConfig;
  layers: LayerConfig[];
}

const DOCKER_HUB_REGISTRY_BASE = "registry-1.docker.io";
const DOCKER_HUB_AUTH_BASE = "auth.docker.io/token";
const DOCKER_HUB_REGISTRY_SERVICE = "registry.docker.io";

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
    Labels: null
  }
};

export class DockerPull {
  private static parseRegistryConfig(
    config: RegistryConfig | undefined
  ): RegistryConfig {
    if (!config) {
      return {
        base: DOCKER_HUB_REGISTRY_BASE,
        authBase: DOCKER_HUB_AUTH_BASE,
        service: DOCKER_HUB_REGISTRY_SERVICE
      } as RegistryConfig;
    }
    return {
      base: config.base ? config.base : DOCKER_HUB_REGISTRY_BASE,
      authBase: config.authBase ? config.authBase : DOCKER_HUB_AUTH_BASE,
      service: config.service ? config.service : DOCKER_HUB_REGISTRY_SERVICE,
      username: config.username,
      password: config.password
    };
  }

  private static async findDockerBinary() {
    return subProcess
      .execute("which", ["docker"], undefined, undefined, true)
      .then(cmdOutput => cmdOutput.stdout.trim())
      .catch(cmdOutput => {
        throw new Error(cmdOutput.stderr);
      });
  }

  constructor(private layersCache?: LayersCacheClient) {}

  public async pull(
    // TODO (leon): refactor
    repo: string,
    tag: string,
    registryConfig?: RegistryConfig,
    org?: string
  ): Promise<DockerPullResult> {
    registryConfig = DockerPull.parseRegistryConfig(registryConfig);

    const token: string = await this.getToken(
      repo,
      registryConfig.service,
      registryConfig.authBase,
      registryConfig.username,
      registryConfig.password
    );

    const manifest: Manifest = await this.getManifest(
      token,
      repo,
      tag,
      registryConfig.base
    );

    const imageConfigMetadata: LayerConfig = manifest.config;
    const imageConfig = await this.getConfig(
      token,
      repo,
      imageConfigMetadata.digest,
      imageConfigMetadata.mediaType,
      registryConfig.base
    );

    const t0 = Date.now();
    const layersConfigs: LayerConfig[] = manifest.layers;
    const [cachedLayers, missingLayers] = await this.getLayers(
      layersConfigs,
      token,
      repo,
      registryConfig
    );
    const pullDuration = Date.now() - t0;

    if (this.layersCache) {
      await this.layersCache.saveLayers(missingLayers);
    }

    let imageDigest: Digest;
    const stagingDir: tmp.DirResult = tmp.dirSync({ unsafeCleanup: true });
    try {
      imageDigest = await this.loadImage(
        imageConfigMetadata.digest,
        imageConfig,
        layersConfigs,
        [...cachedLayers, ...missingLayers],
        repo,
        tag,
        stagingDir
      );
    } catch (err) {
      throw new Error(err.stderr);
    } finally {
      stagingDir.removeCallback();
    }

    return {
      imageDigest,
      cachedLayersDigests: cachedLayers.map(layer => layer.config.digest),
      missingLayersDigests: missingLayers.map(layer => layer.config.digest),
      pullDuration
    };
  }

  private async getLayers(
    layersConfigs: LayerConfig[],
    token: string,
    repo: string,
    registryConfig: RegistryConfig
  ): Promise<[Layer[], Layer[]]> {
    const cachedLayers: Layer[] = this.layersCache
      ? await this.layersCache.getLayers(layersConfigs)
      : [];
    const cachedDigests: Digest[] = cachedLayers.map(
      (layer: Layer) => layer.config.digest
    );
    const missingLayersConfigs: LayerConfig[] = layersConfigs.filter(
      (cfg: LayerConfig) => !cachedDigests.includes(cfg.digest)
    );
    const missingLayers: Layer[] = await Promise.all(
      missingLayersConfigs.map(async (config: LayerConfig) => {
        const blob: Buffer = await this.getLayer(
          token,
          repo,
          config.digest,
          config.mediaType,
          registryConfig.base
        );
        return { config, blob };
      })
    );
    return [cachedLayers, missingLayers];
  }

  private async getToken(
    repo: string,
    registryService: string,
    authBase: string,
    username: string | undefined,
    password: string | undefined
  ): Promise<string> {
    const config: any = {
      method: "GET",
      uri: `https://${authBase}`,
      qs: {
        service: `${registryService}`,
        scope: `repository:${repo}:pull`
      }
    };
    if (username && password) {
      config.auth = {
        username,
        password
      };
    }
    try {
      return request(config).then(response => JSON.parse(response).token);
    } catch (err) {
      // TODO(leon): wrap
      throw new Error(err.message);
    }
  }

  private async getManifest(
    token: string,
    repo: string,
    tag: string,
    registryBase: string
  ): Promise<Manifest> {
    return request({
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.docker.distribution.manifest.v2+json"
      },
      uri: `https://${registryBase}/v2/${repo}/manifests/${tag}`
    })
      .then(response => JSON.parse(response) as Manifest)
      .catch(err => {
        // TODO(leon): wrap
        throw new Error(err.message);
      });
  }

  private async getLayer(
    token: string,
    repo: string,
    sha: Digest,
    mediaType: string,
    registryBase: string
  ): Promise<Buffer> {
    try {
      return await request({
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: `${mediaType}`,
          "Cache-Control": "no-cache, no-store"
        },
        encoding: null,
        uri: `https://${registryBase}/v2/${repo}/blobs/${sha}`
      });
    } catch (err) {
      // TODO(leon): wrap
      throw new Error(err.message);
    }
  }

  private async getConfig(
    token: string,
    repo: string,
    sha: Digest,
    mediaType: string,
    registryBase: string
  ) {
    return request({
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: `${mediaType}`
      },
      uri: `https://${registryBase}/v2/${repo}/blobs/${sha}`
    })
      .then(response => JSON.parse(response))
      .catch(err => {
        // TODO(leon): wrap
        throw new Error(err.message);
      });
  }

  private async loadImage(
    // TODO (leon): refactor
    imageDigest: Digest,
    imageConfig: any,
    layersConfigs: LayerConfig[],
    layers: Layer[],
    repo: string,
    tag: string,
    stagingDir: tmp.DirResult
  ): Promise<Digest> {
    const imgDir = path.join(stagingDir.name, "image");
    fs.mkdirSync(imgDir);

    // write layers
    let parentDigest: Digest | undefined;
    for (const layerConfig of layersConfigs) {
      const digest = layerConfig.digest.replace("sha256:", "");
      const layerDir = path.join(imgDir, digest);
      fs.mkdirSync(layerDir);

      // write layer.tar
      let blob: Buffer;
      for (const layer of layers) {
        if (layerConfig.digest === layer.config.digest) {
          blob = layer.blob;
          break;
        }
      }
      if (!blob) {
        throw new Error(`missing blob during build: ${digest}`);
      }
      await promiseWrite(path.join(layerDir, "layer.tar"), blob);

      // write json
      let json: object = Object.assign({}, { id: digest }, DEFAULT_LAYER_JSON);
      if (parentDigest) {
        json = Object.assign({ parent: parentDigest });
      }
      fs.writeFileSync(path.join(layerDir, "json"), JSON.stringify(json));
      parentDigest = digest;

      // write version
      fs.writeFileSync(path.join(layerDir, "VERSION"), "1.0");
    }

    imageDigest = imageDigest.replace("sha256:", "");
    // write image json
    fs.writeFileSync(
      `${path.join(imgDir, imageDigest)}.json`,
      JSON.stringify(imageConfig)
    );

    // write manifest.json
    const manifestJson = [
      {
        Config: `${imageDigest}.json`,
        RepoTags: null,
        Layers: layersConfigs.map(
          config => `${config.digest.replace("sha256:", "")}/layer.tar`
        )
      }
    ];
    fs.writeFileSync(
      path.join(imgDir, "manifest.json"),
      JSON.stringify(manifestJson)
    );

    await subProcess.execute(
      "tar",
      ["cf", "image.tar", "-C", imgDir, "."],
      stagingDir.name
    );

    const dockerBinary: string = await DockerPull.findDockerBinary();

    const stdout = (await subProcess.execute(
      dockerBinary,
      ["load", "-i", "image.tar"],
      stagingDir.name
    )).stdout;
    // Loaded image ID: sha256:36456e9e9cb7c4b17d97461a5aeb062a481401e3d2b559285c7083d8e7f8efa6
    const imgDigest: Digest = stdout.split("sha256:")[1].trim();
    await subProcess.execute(dockerBinary, [
      "tag",
      `${imgDigest}`,
      `${repo}:${tag}`
    ]);

    return imgDigest;
  }
}
