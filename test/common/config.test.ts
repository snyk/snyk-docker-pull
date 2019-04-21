import * as config from "../../src/common/config";

test("environment variables are present", async () => {
  expect(config).toMatchObject({
    DOCKER_HUB_USERNAME: expect.any(String),
    DOCKER_HUB_PASSWORD: expect.any(String),
    DOCKER_HUB_REPOSITORY: expect.any(String),
    LAYERS_CACHE_MAX_SIZE: expect.any(String),
    LAYERS_CACHE_DIR_PATH: expect.any(String)
  });
});
