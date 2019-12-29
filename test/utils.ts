import * as subProcess from "../src/sub-process";

export async function removeImage(sha: string) {
  try {
    return await subProcess.execute(
      "docker",
      ["rmi", `${sha}`],
      undefined,
      undefined,
      true
    );
  } catch (err) {
    const stderr: string = err.stderr;
    if (!stderr.includes("image is referenced in multiple repositories")) {
      throw new Error(stderr);
    }
  }
}
