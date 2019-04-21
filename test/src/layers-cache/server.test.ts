import * as tmp from "tmp";

import { LayersCache} from "../../../src/layers-cache/server";

test("save/get single layer", async () => {
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  try {
    const cache = new LayersCache(tmpDir.name);
    const expectedBlob = Buffer.alloc(4, "abcd");
    const digest = "sha:123";

    await cache.saveLayer(digest, expectedBlob);
    const resultedBlob = await cache.getLayer(digest);

    expect(resultedBlob).toEqual(expectedBlob);
  } finally {
    tmpDir.removeCallback();
  }
});

test("unused layer is removed", async () => {
    const maxSize = 1;
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    try {
        const cache = new LayersCache(tmpDir.name, maxSize);

        const popularBlob = Buffer.alloc("popular".length, "popular");
        const popularSha = "sha:popular";

        const unPopularBlob = Buffer.alloc("popualar".length, "popular");
        const unPopularSha = "sha:unpopular";

        await cache.saveLayer(popularSha, popularBlob);
        await cache.saveLayer(unPopularSha, unPopularBlob);
        await cache.refreshCache([popularSha, unPopularSha]);
        // either popular or unpopular blob is removed

        await cache.saveLayer(popularSha, popularBlob);
        await cache.refreshCache([popularSha]);
        // popular sha was saved twice (vs one) and maxSize is 1
        // popular blob is guaranteed to be the only one remaining

        const resultPopBlob = await cache.getLayer(popularSha);
        const resultUnPopBlob = await cache.getLayer(unPopularSha);

        expect(resultPopBlob).toEqual(popularBlob);
        expect(resultUnPopBlob).toEqual(Buffer.alloc(0));
    } finally {
        tmpDir.removeCallback();
    }
});
