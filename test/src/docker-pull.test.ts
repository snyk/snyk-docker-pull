import { DockerPull, DockerPullOptions } from "../../src/docker-pull";
import { removeImage, listTar } from "../utils";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as glob from "glob";

jest.setTimeout(40000);

test("private image pull and load", async () => {
  const repo = process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY;

  const opt: DockerPullOptions = {
    username: process.env.SNYK_DRA_DOCKER_HUB_USERNAME,
    password: process.env.SNYK_DRA_DOCKER_HUB_PASSWORD
  };

  // Add pull save request
  const pullSaveRequestPath = path.join(os.tmpdir(), "pullSaveRequest.json");
  fs.writeFileSync(
    pullSaveRequestPath,
    `{
  "foo" : {
    "username" : "${process.env.SNYK_DRA_DOCKER_HUB_USERNAME}",
    "repo" : "${process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY}",
    "tag" : "alpine"
  }
}`
  );

  const dockerPull: DockerPull = new DockerPull();
  const imageDigest: string = (
    await dockerPull.pull("registry-1.docker.io", repo, "alpine", opt)
  ).imageDigest;
  expect(imageDigest).toBeDefined();
  const containerArchives = glob.sync(path.join(os.tmpdir(), "foo-*.tar"));
  expect(containerArchives.length).toBeGreaterThan(0);

  await removeImage(imageDigest);
  fs.unlinkSync(pullSaveRequestPath);
});

test("private image pull and build", async () => {
  const repo = process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY;

  const opt: DockerPullOptions = {
    username: process.env.SNYK_DRA_DOCKER_HUB_USERNAME,
    password: process.env.SNYK_DRA_DOCKER_HUB_PASSWORD,
    loadImage: false
  };

  // Add pull save request
  const pullSaveRequestPath = path.join(os.tmpdir(), "pullSaveRequest.json");
  fs.writeFileSync(
    pullSaveRequestPath,
    `{
  "foo" : {
    "username" : "${process.env.SNYK_DRA_DOCKER_HUB_USERNAME}",
    "repo" : "${process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY}",
    "tag" : "alpine"
  }
}`
  );

  const dockerPull: DockerPull = new DockerPull();
  const stagingDir = (
    await dockerPull.pull("registry-1.docker.io", repo, "alpine", opt)
  ).stagingDir;

  const containerArchives = glob.sync(path.join(os.tmpdir(), "foo-*.tar"));
  expect(containerArchives.length).toBeGreaterThan(0);

  const tarPath = path.join(stagingDir.name, "image.tar");
  expect(fs.existsSync(tarPath)).toBeTruthy();

  stagingDir.removeCallback();
  fs.unlinkSync(pullSaveRequestPath);
});

test("pull from public repo", async () => {
  const registry = "registry-1.docker.io";
  const repo = "library/hello-world";
  const tag = "latest";
  const opt: DockerPullOptions = {
    loadImage: false
  };

  const dockerPull: DockerPull = new DockerPull();
  const resp = await dockerPull.pull(registry, repo, tag, opt);

  const tarPath = path.join(resp.stagingDir.name, "image.tar");
  expect(fs.existsSync(tarPath)).toBeTruthy();

  const tarListing = await listTar(tarPath);
  expect(tarListing.includes("manifest.json")).toBeTruthy();
  expect(tarListing.includes("./manifest.json")).toBeFalsy();
  tarListing.forEach(fileName => expect(fileName).not.toContain("./"));

  resp.stagingDir.removeCallback();
});
