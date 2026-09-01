import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { abortSignalForRequest } from "../src/requestAbort.js";

/**
 * Regression test for a real bug found while investigating a production
 * incident (docs/async-state-incident.md): the first implementation of
 * this function listened on the REQUEST's "close" event, which fires as
 * soon as the request body has been fully read -- confirmed directly to
 * happen within ~1ms of the request arriving, regardless of whether a
 * response has been sent. Wiring an abort to that would have aborted the
 * outbound model call on every single real request within milliseconds,
 * making the app non-functional. The fix listens on the RESPONSE's "close"
 * event instead, which only indicates a genuine premature disconnect when
 * writableEnded is still false.
 */
describe("abortSignalForRequest", () => {
  function buildApp(handler: (req: express.Request, res: express.Response) => void) {
    const app = express();
    app.use(express.json());
    app.post("/test", handler);
    return app;
  }

  it("does NOT abort while a normal request is still being handled, well before the response is sent", async () => {
    let abortedDuringHandling = false;
    const app = buildApp((req, res) => {
      const signal = abortSignalForRequest(req, res);
      setTimeout(() => {
        abortedDuringHandling = signal.aborted;
        res.json({ ok: true });
      }, 100);
    });

    const response = await request(app).post("/test").send({});
    expect(response.status).toBe(200);
    expect(abortedDuringHandling).toBe(false);
  });

  it("does NOT abort after the response has been sent successfully", async () => {
    const app = buildApp((req, res) => {
      const signal = abortSignalForRequest(req, res);
      res.json({ ok: true });
      // Give the response's own "close" event a moment to fire, then verify
      // it did not flip the signal (writableEnded was already true).
      setTimeout(() => {
        expect(signal.aborted).toBe(false);
      }, 50);
    });

    await request(app).post("/test").send({});
    await new Promise((r) => setTimeout(r, 100));
  });

  it("DOES abort when the client disconnects before a response is sent", async () => {
    let resolveAborted!: (value: boolean) => void;
    const abortedPromise = new Promise<boolean>((resolve) => {
      resolveAborted = resolve;
    });

    const app = buildApp((req, res) => {
      const signal = abortSignalForRequest(req, res);
      signal.addEventListener("abort", () => resolveAborted(true));
      // Never actually responds within the test's window -- simulates a
      // slow in-flight model call that the client gives up waiting on.
      setTimeout(() => {
        if (!res.writableEnded) res.json({ ok: true });
      }, 5000);
    });

    const server = app.listen(0);
    const port = (server.address() as { port: number }).port;

    const controller = new AbortController();
    const fetchPromise = fetch(`http://127.0.0.1:${port}/test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal: controller.signal,
    }).catch(() => {
      /* expected: the client's own abort rejects this fetch */
    });

    setTimeout(() => controller.abort(), 100);

    const aborted = await Promise.race([abortedPromise, new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))]);
    expect(aborted).toBe(true);

    await fetchPromise;
    server.close();
  });
});
