import { types } from "@snyk/docker-registry-v2-client";
import * as registryClient from "@snyk/docker-registry-v2-client";
import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
import { Layer, promiseWrite } from "./common";
import * as subProcess from "./sub-process";

export interface DockerPullResult {
  imageDigest: string;
  stagingDir: tmp.DirResult | null;
  /** @deprecated caching is no longer used */
  cachedLayersDigests: string[];
  missingLayersDigests: string[];
  pullDuration: number;
}

const DEFAULT_LAYER_JSON = {
  created: "0001-01-01T00:00:00Z",
  // eslint-disable-next-line @typescript-eslint/camelcase
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
  private static async findDockerBinary(): Promise<string> {
    return subProcess
      .execute("which", ["docker"], undefined, undefined, true)
      .then(cmdOutput => cmdOutput.stdout.trim())
      .catch(cmdOutput => {
        throw new Error(cmdOutput.stderr);
      });
  }

  public async pull(
    username: string,
    password: string,
    registryBase: string,
    repo: string,
    tag: string,
    // weak typing on the client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reqOptions = {} as any,
    loadImage = true
  ): Promise<DockerPullResult> {
    const manifest: types.ImageManifest = await registryClient.getManifest(
      registryBase,
      repo,
      tag,
      username,
      password,
      reqOptions
    );

    const imageConfigMetadata: types.LayerConfig = manifest.config;
    const imageConfig = await registryClient.getImageConfig(
      registryBase,
      repo,
      imageConfigMetadata.digest,
      username,
      password,
      reqOptions
    );
    const t0 = Date.now();
    const layersConfigs: types.LayerConfig[] = manifest.layers;
    const missingLayers = await this.getLayers(
      layersConfigs,
      registryBase,
      username,
      password,
      repo,
      reqOptions
    );
    const pullDuration = Date.now() - t0;

    let imageDigest: string;
    const stagingDir: tmp.DirResult = tmp.dirSync({ unsafeCleanup: true });

    try {
      await this.buildImage(
        imageConfigMetadata.digest,
        imageConfig,
        layersConfigs,
        missingLayers,
        stagingDir
      );

      if (loadImage) {
        imageDigest = await this.loadImage(registryBase, repo, tag, stagingDir);
      }
    } catch (err) {
      throw new Error(err.stderr);
    } finally {
      if (loadImage) {
        stagingDir.removeCallback();
      }
    }

    return {
      imageDigest,
      stagingDir: loadImage ? null : stagingDir,
      cachedLayersDigests: [],
      missingLayersDigests: missingLayers.map(layer => layer.config.digest),
      pullDuration
    };
  }

  private async getLayers(
    layersConfigs: types.LayerConfig[],
    registryBase,
    username,
    password,
    repo: string,
    // weak typing on the client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reqOptions = {} as any
  ): Promise<Layer[]> {
    return await Promise.all(
      layersConfigs.map(async (config: types.LayerConfig) => {
        const blob: Buffer = await registryClient.getLayer(
          registryBase,
          repo,
          config.digest,
          username,
          password,
          reqOptions
        );
        return { config, blob };
      })
    );
  }

  private async buildImage(
    imageDigest: string,
    imageConfig: object,
    layersConfigs: types.LayerConfig[],
    layers: Layer[],
    stagingDir: tmp.DirResult
  ): Promise<string> {
    const imgDir = path.join(stagingDir.name, "image");
    fs.mkdirSync(imgDir);

    // write layers
    let parentDigest: string | undefined;
    for (const layerConfig of layersConfigs) {
      const digest = layerConfig.digest.replace("sha256:", "");
      const layerDir = path.join(imgDir, digest);
      // layer might already exist
      if (fs.existsSync(layerDir)) {
        continue;
      }
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
      ["cf", "image.tar", "--xform", "s:\\./\\?::", "-C", imgDir, "."],
      stagingDir.name
    );

    return path.join(stagingDir.name, "image.tar");
  }

  private async loadImage(
    registryBase: string,
    repo: string,
    tag: string,
    stagingDir: tmp.DirResult
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
      `${registryBase}/${repo}:${tag}`
    ]);

    return imgDigest;
  }
}
