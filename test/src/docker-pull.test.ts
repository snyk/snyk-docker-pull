import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as glob from "glob";
import * as fx from "mkdir-recursive";

import { DockerPull } from "../../src/docker-pull";
import { DockerPullOptions } from "../../src/types";
import {
  removeImage,
  listTar,
  getTarFileContents,
  getTarFileDigest,
} from "../utils";
import { contentTypes } from "@snyk/docker-registry-v2-client";

function rmdirRecursive(customPath: string[]): void {
  if (customPath.length < 2) {
    return;
  }

  fs.rmdirSync(path.join(...customPath));
  const next = customPath.slice(0, customPath.length - 1);
  rmdirRecursive(next);
}

jest.setTimeout(40000);

test("private image pull and load", async () => {
  const repo = process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY;

  const opt: DockerPullOptions = {
    username: process.env.SNYK_DRA_DOCKER_HUB_USERNAME,
    password: process.env.SNYK_DRA_DOCKER_HUB_PASSWORD,
  };

  // Add pull save request
  const pullSaveRequestPath = path.join(os.tmpdir(), "pullSaveRequest.json");
  fs.writeFileSync(
    pullSaveRequestPath,
    `{
  "foo" : {
    "username" : "${process.env.SNYK_DRA_DOCKER_HUB_USERNAME}",
    "repo" : "${process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY}",
    "tag" : "alpine"
  }
}`
  );

  const dockerPull: DockerPull = new DockerPull();
  const dockerPullResult = await dockerPull.pull(
    "registry-1.docker.io",
    repo,
    "alpine",
    opt
  );

  const imageDigest = dockerPullResult.imageDigest;
  const manifestDigest = dockerPullResult.manifestDigest;

  expect(imageDigest).toBeDefined();
  expect(manifestDigest).toBeDefined();
  const containerArchives = glob.sync(path.join(os.tmpdir(), "foo-*.tar"));
  expect(containerArchives.length).toBeGreaterThan(0);

  await removeImage(imageDigest);
  fs.unlinkSync(pullSaveRequestPath);
});

test("private image pull and build", async () => {
  const repo = process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY;

  const opt: DockerPullOptions = {
    username: process.env.SNYK_DRA_DOCKER_HUB_USERNAME,
    password: process.env.SNYK_DRA_DOCKER_HUB_PASSWORD,
    loadImage: false,
  };

  // Add pull save request
  const pullSaveRequestPath = path.join(os.tmpdir(), "pullSaveRequest.json");
  fs.writeFileSync(
    pullSaveRequestPath,
    `{
  "foo" : {
    "username" : "${process.env.SNYK_DRA_DOCKER_HUB_USERNAME}",
    "repo" : "${process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY}",
    "tag" : "alpine"
  }
}`
  );

  const dockerPull: DockerPull = new DockerPull();
  const stagingDir = (
    await dockerPull.pull("registry-1.docker.io", repo, "alpine", opt)
  ).stagingDir;

  const containerArchives = glob.sync(path.join(os.tmpdir(), "foo-*.tar"));
  expect(containerArchives.length).toBeGreaterThan(0);

  const tarPath = path.join(stagingDir.name, "image.tar");
  expect(fs.existsSync(tarPath)).toBeTruthy();

  stagingDir.removeCallback();
  fs.unlinkSync(pullSaveRequestPath);
});

test("private multiarch manifest digest pull and build", async () => {
  const repo = `${process.env.SNYK_DRA_DOCKER_HUB_REPOSITORY}-multiarch`;
  const multiArchManifestDigestWithAmd64 =
    "sha256:5e2cb9c57eaef5ab6c99e7f7620ebf3c1c580928cf450e155e1b6306c6dd1939";
  const manifestDigestWithAmd64 =
    "sha256:71a2b866473e26e7c3dfcd7488975ed8d8ba46c495f76a50957fc11f2d6f4dec";

  const opt: DockerPullOptions = {
    username: process.env.SNYK_DRA_DOCKER_HUB_USERNAME,
    password: process.env.SNYK_DRA_DOCKER_HUB_PASSWORD,
    loadImage: false,
  };

  // Add pull save request
  const pullSaveRequestPath = path.join(os.tmpdir(), "pullSaveRequest.json");
  fs.writeFileSync(
    pullSaveRequestPath,
    `{
  "foo" : {
    "username" : "${process.env.SNYK_DRA_DOCKER_HUB_USERNAME}",
    "repo" : "${repo}",
    "tag" : "${multiArchManifestDigestWithAmd64}"
  }
}`
  );

  const dockerPull: DockerPull = new DockerPull();
  const dockerPullResult = await dockerPull.pull(
    "registry-1.docker.io",
    repo,
    multiArchManifestDigestWithAmd64,
    opt
  );

  const stagingDir = dockerPullResult.stagingDir;
  const indexDigest = dockerPullResult.indexDigest;
  const manifestDigest = dockerPullResult.manifestDigest;

  expect(indexDigest).toEqual(multiArchManifestDigestWithAmd64);
  expect(manifestDigest).toEqual(manifestDigestWithAmd64);

  const containerArchives = glob.sync(path.join(os.tmpdir(), "foo-*.tar"));
  expect(containerArchives.length).toBeGreaterThan(0);

  const tarPath = path.join(stagingDir.name, "image.tar");
  expect(fs.existsSync(tarPath)).toBeTruthy();

  stagingDir.removeCallback();
  fs.unlinkSync(pullSaveRequestPath);
});

test("private OCI multiarch manifest digest pull and build by digest", async () => {
  const repo = `${process.env.SNYK_OCI_MULTI_ARCH_DOCKER_HUB_REPOSITORY}`;
  const multiArchManifestDigest =
    "sha256:c6163adfda796463a5691fc9f29733320ca2846985ba3708e0d490fbcbdc66f8";
  const manifestDigest =
    "sha256:1c3edab5eefea4ef5a2e7f462d414e1fcc84032f2da540f077baa1c8a51c5bfa";

  const opt: DockerPullOptions = {
    username: process.env.SNYK_DRA_DOCKER_HUB_USERNAME,
    password: process.env.SNYK_DRA_DOCKER_HUB_PASSWORD,
    loadImage: false,
    reqOptions: {
      acceptManifest: `${contentTypes.OCI_INDEX_V1},${contentTypes.OCI_MANIFEST_V1}`,
    },
  };

  const dockerPull: DockerPull = new DockerPull();
  const dockerPullResult = await dockerPull.pull(
    "registry-1.docker.io",
    repo,
    multiArchManifestDigest,
    opt
  );

  const stagingDir = dockerPullResult.stagingDir;
  const indexDigestResult = dockerPullResult.indexDigest;
  const manifestDigestResult = dockerPullResult.manifestDigest;

  expect(indexDigestResult).toEqual(multiArchManifestDigest);
  expect(manifestDigestResult).toEqual(manifestDigest);

  const tarPath = path.join(stagingDir.name, "image.tar");
  expect(fs.existsSync(tarPath)).toBeTruthy();

  const tarContents = await listTar(tarPath);

  expect(tarContents).toContain("oci-layout");
  const ociLayoutData = await getTarFileContents(tarPath, "oci-layout");
  expect(JSON.parse(ociLayoutData.toString())).toEqual({
    imageLayoutVersion: "1.0.0",
  });

  expect(tarContents).toContain("index.json");
  const ociIndexData = await getTarFileContents(tarPath, "index.json");
  expect(JSON.parse(ociIndexData.toString())).toEqual({
    manifests: [
      {
        digest:
          "sha256:1c3edab5eefea4ef5a2e7f462d414e1fcc84032f2da540f077baa1c8a51c5bfa",
        mediaType: "application/vnd.oci.image.manifest.v1+json",
        size: 2747,
      },
    ],
    mediaType: "application/vnd.oci.image.index.v1+json",
    schemaVersion: 2,
  });

  const blobDigests = [
    "10f855b03c8aee4fb0b9b7031c333640d684bd9ee6045f11f9892c7fea394701",
    "fe5ca62666f04366c8e7f605aa82997d71320183e99962fa76b3209fdfbb8b58",
    "b438aade392267e4f99f3bac4b6c46de104f45b105c930014a9045b426b1cec1",
    "fcb6f6d2c9986d9cd6a2ea3cc2936e5fc613e09f1af9042329011e43057f3265",
    "e8c73c638ae9ec5ad70c49df7e484040d889cca6b4a9af056579c3d058ea93f0",
    "1e3d9b7d145208fa8fa3ee1c9612d0adaac7255f1bbc9ddea7e461e0b317805c",
    "4aa0ea1413d37a58615488592a0b827ea4b2e48fa5a77cf707d0e35f025e613f",
    "7c881f9ab25e0d86562a123b5fb56aebf8aa0ddd7d48ef602faf8d1e7cf43d8c",
    "5627a970d25e752d971a501ec7e35d0d6fdcd4a3ce9e958715a686853024794a",
    "738ab95077bc1c6cc3350efb550dfba2a815a47d1ab4d0d7fde5b73a1067f555",
    "80ec95682aee84c463cbf19b82eef5e1707c5e31b7be9750e1a90bff8b4183ee",
    "f51c8fa85103a5c3ac5ec1969b693ccc0dc2b409dec106e4025e31c436c0c740",
    "dfc02eb7708f919bb3b56c008561e4430ea87cd33bc93cb65c2c3c7f0908e5cf",
    "52907d314ddce378f3f36e26629baef60c71d72a0620b9d31c47c8cb9de6467e",
    "4eec690774a46467a912715848c71dbbdb049008b2252432155522a7f9ccfa92",
    "0cdb6033fd9e9135e48cb31fd1643fae40369e7e743af7aeb7c9d0ef1dae86fc",
    "1c3edab5eefea4ef5a2e7f462d414e1fcc84032f2da540f077baa1c8a51c5bfa",
    "568d710b8740f29824eada3645b5986a360a424b1c15fc08f961226568db322b",
  ];

  for (const digest of blobDigests) {
    expect(tarContents).toContain(`blobs/sha256/${digest}`);
    expect(
      await getTarFileDigest(tarPath, `blobs/sha256/${digest}`, "sha256")
    ).toEqual(digest);
  }
});

test("private OCI multiarch manifest digest pull and build by tag", async () => {
  const repo = `${process.env.SNYK_OCI_MULTI_ARCH_DOCKER_HUB_REPOSITORY}`;
  const multiArchManifestDigest =
    "sha256:c6163adfda796463a5691fc9f29733320ca2846985ba3708e0d490fbcbdc66f8";
  const manifestDigest =
    "sha256:1c3edab5eefea4ef5a2e7f462d414e1fcc84032f2da540f077baa1c8a51c5bfa";

  const opt: DockerPullOptions = {
    username: process.env.SNYK_DRA_DOCKER_HUB_USERNAME,
    password: process.env.SNYK_DRA_DOCKER_HUB_PASSWORD,
    loadImage: false,
    reqOptions: {
      acceptManifest: `${contentTypes.OCI_INDEX_V1},${contentTypes.OCI_MANIFEST_V1}`,
    },
  };

  const dockerPull: DockerPull = new DockerPull();
  const dockerPullResult = await dockerPull.pull(
    "registry-1.docker.io",
    repo,
    "latest",
    opt
  );

  const stagingDir = dockerPullResult.stagingDir;
  const indexDigestResult = dockerPullResult.indexDigest;
  const manifestDigestResult = dockerPullResult.manifestDigest;

  expect(indexDigestResult).toEqual(multiArchManifestDigest);
  expect(manifestDigestResult).toEqual(manifestDigest);

  const tarPath = path.join(stagingDir.name, "image.tar");
  expect(fs.existsSync(tarPath)).toBeTruthy();

  const tarContents = await listTar(tarPath);

  expect(tarContents).toContain("oci-layout");
  const ociLayoutData = await getTarFileContents(tarPath, "oci-layout");
  expect(JSON.parse(ociLayoutData.toString())).toEqual({
    imageLayoutVersion: "1.0.0",
  });

  expect(tarContents).toContain("index.json");
  const ociIndexData = await getTarFileContents(tarPath, "index.json");
  expect(JSON.parse(ociIndexData.toString())).toEqual({
    manifests: [
      {
        digest:
          "sha256:1c3edab5eefea4ef5a2e7f462d414e1fcc84032f2da540f077baa1c8a51c5bfa",
        mediaType: "application/vnd.oci.image.manifest.v1+json",
        size: 2747,
      },
    ],
    mediaType: "application/vnd.oci.image.index.v1+json",
    schemaVersion: 2,
  });

  const blobDigests = [
    "10f855b03c8aee4fb0b9b7031c333640d684bd9ee6045f11f9892c7fea394701",
    "fe5ca62666f04366c8e7f605aa82997d71320183e99962fa76b3209fdfbb8b58",
    "b438aade392267e4f99f3bac4b6c46de104f45b105c930014a9045b426b1cec1",
    "fcb6f6d2c9986d9cd6a2ea3cc2936e5fc613e09f1af9042329011e43057f3265",
    "e8c73c638ae9ec5ad70c49df7e484040d889cca6b4a9af056579c3d058ea93f0",
    "1e3d9b7d145208fa8fa3ee1c9612d0adaac7255f1bbc9ddea7e461e0b317805c",
    "4aa0ea1413d37a58615488592a0b827ea4b2e48fa5a77cf707d0e35f025e613f",
    "7c881f9ab25e0d86562a123b5fb56aebf8aa0ddd7d48ef602faf8d1e7cf43d8c",
    "5627a970d25e752d971a501ec7e35d0d6fdcd4a3ce9e958715a686853024794a",
    "738ab95077bc1c6cc3350efb550dfba2a815a47d1ab4d0d7fde5b73a1067f555",
    "80ec95682aee84c463cbf19b82eef5e1707c5e31b7be9750e1a90bff8b4183ee",
    "f51c8fa85103a5c3ac5ec1969b693ccc0dc2b409dec106e4025e31c436c0c740",
    "dfc02eb7708f919bb3b56c008561e4430ea87cd33bc93cb65c2c3c7f0908e5cf",
    "52907d314ddce378f3f36e26629baef60c71d72a0620b9d31c47c8cb9de6467e",
    "4eec690774a46467a912715848c71dbbdb049008b2252432155522a7f9ccfa92",
    "0cdb6033fd9e9135e48cb31fd1643fae40369e7e743af7aeb7c9d0ef1dae86fc",
    "1c3edab5eefea4ef5a2e7f462d414e1fcc84032f2da540f077baa1c8a51c5bfa",
    "568d710b8740f29824eada3645b5986a360a424b1c15fc08f961226568db322b",
  ];

  for (const digest of blobDigests) {
    expect(tarContents).toContain(`blobs/sha256/${digest}`);
    expect(
      await getTarFileDigest(tarPath, `blobs/sha256/${digest}`, "sha256")
    ).toEqual(digest);
  }
});

test("pull from public repo", async () => {
  const registry = "registry-1.docker.io";
  const repo = "library/hello-world";
  const tag = "latest";
  const opt: DockerPullOptions = {
    loadImage: false,
    imageSavePath: "./custom/image/save/path",
    reqOptions: {
      acceptManifest: [
        contentTypes.OCI_INDEX_V1,
        contentTypes.OCI_MANIFEST_V1,
      ].join(","),
    },
  };
  // the custom path won't be create by the lib
  fx.mkdirSync(opt.imageSavePath);

  const dockerPull: DockerPull = new DockerPull();
  const resp = await dockerPull.pull(registry, repo, tag, opt);

  const manifestDigest = resp.manifestDigest;
  expect(manifestDigest).toBeDefined();

  const tarPath = path.join(resp.stagingDir.name, "image.tar");
  expect(tarPath).toBe(path.join(resp.stagingDir.name, "image.tar"));
  expect(fs.existsSync(tarPath)).toBeTruthy();

  const tarListing = await listTar(tarPath);
  expect(tarListing.includes("index.json")).toBeTruthy();
  expect(tarListing.includes("./index.json")).toBeFalsy();
  tarListing.forEach((fileName) => expect(fileName).not.toContain("./"));

  // it won't do nothing because we set imageSavePath
  resp.stagingDir.removeCallback();
  // clean up
  fs.unlinkSync(tarPath);
  rmdirRecursive(opt.imageSavePath.split(path.sep));
});
