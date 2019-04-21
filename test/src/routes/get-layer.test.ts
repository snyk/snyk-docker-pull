import * as path from "path";

import * as mockFs from "mock-fs";
import * as supertest from "supertest";

import * as config from "../../../src/common/config";
import { app } from "../../../src/layers-cache/app";

test("get-layer", async () => {
  const layersDir = path.join(config.LAYERS_CACHE_DIR_PATH, "digest");
  mockFs({
    layersDir: Buffer.alloc("blob".length, "blolb")
  });

  const res = await supertest(app)
    .get("/get-layer")
    .set({ digest: "sha:123" });
  expect(res).toBeUndefined();

  mockFs.restore();
});
