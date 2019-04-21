import * as express from "express";
import { Logger } from "../../common/logger";
import { layersCache } from "../app";

const logger = Logger("get-layer");

export async function getLayer(req: express.Request, res: express.Response) {
  const blob: Buffer = await layersCache.getLayer(req.headers.digest);
  return res
    .status(200)
    .send(blob)
    .end();
}
