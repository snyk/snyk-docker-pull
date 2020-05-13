import { DockerPull } from "../../src/docker-pull";
import { removeImage } from "../utils";
import * as path from "path";
import * as fs from "fs";

jest.setTimeout(40000);

test("private image pull and load", async () => {
  const username = process.env.SNYK_DRA_DOCKER_HUB_USERNAME;
  const password = process.env.SNYK_DRA_DOCKER_HUB_PASSWORD;
  const repo = process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY;

  const dockerPull: DockerPull = new DockerPull();
  const imageDigest: string = (
    await dockerPull.pull(
      username,
      password,
      "registry-1.docker.io",
      repo,
      "alpine"
    )
  ).imageDigest;
  expect(imageDigest).toBeDefined();

  await removeImage(imageDigest);
});

test("private image pull and build", async () => {
  const username = process.env.SNYK_DRA_DOCKER_HUB_USERNAME;
  const password = process.env.SNYK_DRA_DOCKER_HUB_PASSWORD;
  const repo = process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY;

  const dockerPull: DockerPull = new DockerPull();
  const stagingDir = (
    await dockerPull.pull(
      username,
      password,
      "registry-1.docker.io",
      repo,
      "alpine",
      {},
      false
    )
  ).stagingDir;

  expect(fs.existsSync(path.join(stagingDir.name, "image.tar"))).toBeTruthy();

  stagingDir.removeCallback();
});
