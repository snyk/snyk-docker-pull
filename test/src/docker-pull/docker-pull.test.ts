import * as config from "../../../src/common/config";
import {
  DockerPull,
  RegistryConfig
} from "../../../src/docker-pull/docker-pull";
import { removeImage } from "../../utils";

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
    `${config.DOCKER_HUB_USERNAME}/${config.DOCKER_HUB_REPOSITORY}`,
    "wordpress33",
    {
      username: config.DOCKER_HUB_USERNAME,
      password: config.DOCKER_HUB_PASSWORD
    } as RegistryConfig
  );
  expect(imgSha).toBeDefined();

  await removeImage(imgSha);
});
