import { DockerPull } from "../../src/docker-pull";
import { removeImage } from "../utils";

jest.setTimeout(40000);

test("private image pull", async () => {
  const username = process.env.SNYK_DRA_DOCKER_HUB_USERNAME;
  const password = process.env.SNYK_DRA_DOCKER_HUB_PASSWORD;
  const repo = process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY;

  const dockerPull: DockerPull = new DockerPull();
  const imageDigest: string = (await dockerPull.pull(
    username,
    password,
    "registry-1.docker.io",
    repo,
    "alpine"
  )).imageDigest;
  expect(imageDigest).toBeDefined();

  await removeImage(imageDigest);
});
