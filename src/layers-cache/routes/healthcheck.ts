import express = require("express");
import newrelic = require("newrelic");
import config = require("../../common/config");

const router = express.Router();

export = router;

router.get("/", async (req, res) => {
  try {
    const healthcheckResult = await healthcheck();
    // good healthchecks mask our real performance, so let's ignore them
    newrelic.setIgnoreTransaction(true);
    res.status(200).send(healthcheckResult);
  } catch (err) {
    res.status(500).send();
  }
});

async function healthcheck() {
  const data = {
    gitSha: config.GIT_COMMIT_SHA || "none",
  };
  // race checks against timeout
  try {
    await Promise.race([
      new Promise((resolve, reject) =>
        setTimeout(
          () => reject(new Error("Healthcheck timeout")),
          config.HEALTHCHECK_TIMEOUT,
        ).unref(),
      ),
    ]);

    return Object.assign(data, {
      ok: true,
    });
  } catch (err) {
    throw err;
  }
}