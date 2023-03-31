import * as crypto from "crypto";
import { createReadStream } from "fs";
import * as internal from "stream";
import { extract, Extract } from "tar-stream";
import * as subProcess from "../src/sub-process";

const DEFAULT_CWD = undefined;
const DEFAULT_ENV = undefined;

export async function removeImage(sha: string): Promise<subProcess.CmdOutput> {
  try {
    return await subProcess.execute(
      "docker",
      ["rmi", `${sha}`],
      DEFAULT_CWD,
      DEFAULT_ENV,
      true
    );
  } catch (err) {
    const stderr: string = err.stderr;
    if (!stderr.includes("image is referenced in multiple repositories")) {
      throw new Error(stderr);
    }
  }
}

export async function listTar(tarFilePath: string): Promise<string[]> {
  const tarExtractor: Extract = extract();
  const tarFileNames = [];
  await new Promise((resolve, reject) => {
    tarExtractor.on("entry", async (header, stream, next) => {
      tarFileNames.push(header.name);
      stream.on("end", () => {
        next(); // ready for next entry
      });
      stream.resume(); // auto drain the stream
    });

    tarExtractor.on("finish", resolve);
    tarExtractor.on("error", (error) => reject(error));

    createReadStream(tarFilePath).pipe(tarExtractor);
  });
  return tarFileNames;
}

export async function getTarFileContents(
  tarFilePath: string,
  internalFilePath: string
): Promise<Buffer | null> {
  return await new Promise((resolve, reject) => {
    const tarExtractor: Extract = extract();

    tarExtractor.on("entry", async (header, stream, next) => {
      if (header.name === internalFilePath) {
        const contents = await streamToBuffer(stream);
        resolve(contents);
      }

      stream.resume();
      next();
    });

    tarExtractor.on("finish", () => resolve(null));
    tarExtractor.on("error", (error) => reject(error));

    createReadStream(tarFilePath).pipe(tarExtractor);
  });
}

export async function getTarFileDigest(
  tarFilePath: string,
  internalFilePath: string,
  hashAlgorithm: string
): Promise<string> {
  return crypto
    .createHash(hashAlgorithm)
    .update(await getTarFileContents(tarFilePath, internalFilePath))
    .digest("hex");
}

async function streamToBuffer(stream: internal.PassThrough): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    stream.on("error", (error) => reject(error));

    const chunks: Buffer[] = [];
    stream.on("data", (data: Buffer) => {
      chunks.push(data);
    });
    stream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}
