import { DockerPull, RegistryConfig } from "../../src/docker-pull";
import { removeImage } from "../utils";

jest.setTimeout(40000);

test("public image pull", async () => {
  const dockerPull: DockerPull = new DockerPull();
  const imgSha: string = await dockerPull.pull("library/node", "alpine");
  expect(imgSha).toBeDefined();

  await removeImage(imgSha);
});

test("private image pull", async () => {
  const username = process.env.SNYK_DOCKER_HUB_USERNAME;
  const password = process.env.SNYK_DOCKER_HUB_PASSWORD;
  const repo = process.env.SNYK_DOCKER_HUB_REPOSITORY;

  const dockerPull: DockerPull = new DockerPull();
  const imgSha: string = await dockerPull.pull(
    `${username}/${repo}`,
    "alpine",
    { username, password } as RegistryConfig
  );
  expect(imgSha).toBeDefined();

  await removeImage(imgSha);
});
