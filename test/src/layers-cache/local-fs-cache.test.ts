import * as tmp from "tmp";

import { LocalFSCache } from "../../../src/layers-cache/local-fs-cache";

test("save/get single layer", async () => {
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  try {
    const fsCache = new LocalFSCache(tmpDir.name);
    const blob = Buffer.alloc(4, "abcd");
    const mediaType = "tar";
    const digest = "sha:123";
    const config = { mediaType, digest, size: blob.length };
    const layer = { config, blob };

    await fsCache.saveLayers([layer]);
    const cachedLayers = await fsCache.getLayers([config]);

    expect(cachedLayers.length).toEqual(1);
    expect(cachedLayers[0].config).toEqual(config);
    expect(cachedLayers[0].blob).toEqual(blob);
  } finally {
    tmpDir.removeCallback();
  }
});

test("unused layer is removed", async () => {
    const maxSize = 1;
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    try {
        const fsCache = new LocalFSCache(tmpDir.name, maxSize);
        const blob = new Buffer("abcd");
        const size = blob.length;
        const mediaType = "tar";

        const unPopular = "sha:rebecca-black";
        const unPopularLayerConfig = { digest: unPopular, mediaType, size };
        await fsCache.saveLayers([{ blob, config: unPopularLayerConfig }]);
        await fsCache.refreshCache('org', [unPopularLayerConfig ]);
        // no excees at this point

        const popular = "sha:popular";
        const popularLayerConfig = { digest: popular, mediaType, size}
        await fsCache.saveLayers([{ blob, config: popularLayerConfig}]);
        await fsCache.refreshCache("org0", [popularLayerConfig])
        // either could be removed (both layers are used by a single org)

        await fsCache.saveLayers([{ blob, config: popularLayerConfig}]);
        await fsCache.refreshCache("org1", [popularLayerConfig])
        // unpopular layer is removed -- popular layer is used by 2 orgs
        // whilst unpopular is used by 1 (cache max size is 1)

        const cachedLayers = await fsCache.getLayers([popularLayerConfig, unPopularLayerConfig]);
        expect(cachedLayers.length).toEqual(1);
        expect(cachedLayers[0].config.digest).toEqual(popular);
    } finally {
        tmpDir.removeCallback();
    }
});
