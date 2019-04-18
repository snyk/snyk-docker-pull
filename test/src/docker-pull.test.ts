import * as tmp from "tmp";
import { DockerPull, RegistryConfig } from "../../src/docker-pull";
import { LocalFSCache } from "../../src/layers-cache/local-fs-cache";
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

test("public image pull with cached layers is faster", async () => {
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  try {
    const fsCache = new LocalFSCache(tmpDir.name);
    const dockerPull: DockerPull = new DockerPull(fsCache);

    let t0 = Date.now();
    let sha = await dockerPull.pull("library/node", "alpine");
    const r0 = Date.now() - t0;
    await removeImage(sha);

    t0 = Date.now();
    sha = await dockerPull.pull("library/node", "alpine");
    const r1 = Date.now() - t0;
    await removeImage(sha);

    expect(r0).toBeGreaterThan(r1);
  } finally {
    tmpDir.removeCallback();
  }
});
