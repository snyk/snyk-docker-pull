import * as express from "express";
import { Logger } from "../../common/logger";
import { layersCache } from "../app";

const logger = Logger("save-layer");

export async function saveLayer(req: express.Request, res: express.Response) {
    const digest = req.headers.digest;
    await layersCache.saveLayer(digest, req.body);
}
