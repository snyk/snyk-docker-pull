import * as registryClient from "docker-registry-v2-client";
import { types } from "docker-registry-v2-client";
import * as fs from "fs";
import * as readDirRecursive from "fs-readdir-recursive";
import * as path from "path";
import * as tmp from "tmp";
import { promiseWrite } from "./common";
import * as subProcess from "./sub-process";

export interface LayersDiff {
  introduced: string[];
  removed: string[];
}

export async function imageDiffs(
  registryBase,
  repo,
  tag,
  username?,
  password?
): Promise<LayersDiff[]> {
  const manifest = await registryClient.getManifest(
    registryBase,
    repo,
    tag,
    username,
    password
  );
  const result = [];

  const layersConfigs: types.LayerConfig[] = manifest.layers;
  for (const config of layersConfigs) {
    result.push(
      await layersDiff(registryBase, repo, config.digest, username, password)
    );
  }
  return result;
}

export async function layersDiff(
  registryBase: string,
  repo: string,
  digest: string,
  username?: string,
  password?: string
): Promise<LayersDiff> {
  const blob = await registryClient.getLayer(
    registryBase,
    repo,
    digest,
    username,
    password
  );

  const introduced: string[] = [];
  const removed: string[] = [];
  const result: LayersDiff = { introduced, removed };

  const layerContent = await getLayerContent(blob);
  for (const file of layerContent) {
    const name = file.split("/").pop();
    const container = name.startsWith(".wh.") ? removed : introduced;
    container.push(name.replace(".wh.", ""));
  }

  return result;
}

async function getLayerContent(blob): Promise<string[]> {
  const stagingDir: tmp.DirResult = tmp.dirSync({ unsafeCleanup: true });

  try {
    const layerStagingDir = path.join(stagingDir.name, "LAYER_STAGING");
    await writeExtractBlob(layerStagingDir, blob);
    return readDirRecursive(layerStagingDir, noFilter);
  } finally {
    stagingDir.removeCallback();
  }
}

async function writeExtractBlob(name, blob) {
  const blobFile = `${name}.tar`;
  await promiseWrite(blobFile, blob);

  await fs.mkdirSync(name);
  await subProcess.execute("tar", ["xf", blobFile, "-C", name]);
}

// default readdir-recursive filter is "." filter, which we don't need
function noFilter(file) {
  return true;
}
