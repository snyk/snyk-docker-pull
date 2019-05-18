import { imageDiffs, LayersDiff } from "../../src/docker-diff";

jest.setTimeout(40000);

test("test image diffs", async () => {
  const username = process.env.SNYK_DRA_DOCKER_HUB_USERNAME;
  const password = process.env.SNYK_DRA_DOCKER_HUB_PASSWORD;
  const repo = process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY;

  const diffs: LayersDiff[] = await imageDiffs(
    "registry-1.docker.io",
    repo,
    "diff-test",
    username,
    password
  );
  expect(diffs.length).toEqual(4);
});
