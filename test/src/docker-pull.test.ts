import * as tmp from "tmp";
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
  const dockerPull: DockerPull = new DockerPull();
  const imgSha: string = await dockerPull.pull(
    "snykgoof/dockerhub-goof",
    "wordpress33",
    { username: "snykgoof", password: "123456" } as RegistryConfig
  );
  expect(imgSha).toBeDefined();

  await removeImage(imgSha);
});
