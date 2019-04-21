import bodyParser = require("body-parser");
import compression = require("compression");
import express = require("express");
import responseTime = require("response-time");
import config = require("../common/config");
import sentry = require("../common/sentry");
import heathCheck = require("./routes/healthcheck");

import { getLayer } from "./routes/get-layer";
import { saveLayer } from "./routes/save-layer";
import { LayersCache } from "./server";

export const app = express();
export const layersCache = new LayersCache(
  config.LAYERS_CACHE_DIR_PATH,
  config.LAYERS_CACHE_MAX_SIZE
);

app.use(bodyParser.json({ limit: config.PAYLOAD_MAX_SIZE }));
app.use(compression());
app.use(sentry.errorHandler());
app.use(sentry.requestHandler());
app.use(responseTime()); // adds a X-Response-Time header to responses

app.use("/healthcheck", heathCheck);
app.get("/get-layer", getLayer);
app.post("/save-layer", saveLayer);
