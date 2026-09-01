import type { Request, Response } from "express";

/**
 * An AbortSignal that fires only on a genuine premature disconnect -- the
 * client navigated away, closed the tab, or its own client-side timeout
 * aborted the fetch -- so the server stops spending further time and real
 * API cost on a call nobody is waiting for anymore.
 *
 * This listens on the RESPONSE's "close" event, not the request's. An
 * Express/Node IncomingMessage (req) emits "close" as soon as its body has
 * been fully read -- typically within a millisecond of the request
 * arriving, long before any response is sent -- because that just means
 * the readable request stream is done, not that the connection is gone.
 * Wiring an abort to req's "close" aborts the outbound model call almost
 * immediately on every single request, real or not (confirmed directly:
 * req 'close' fired 1ms after receipt while a response wasn't sent until
 * 1003ms later). res's "close" event, by contrast, only fires either after
 * the response has actually been sent (writableEnded true -- not a
 * disconnect) or when the underlying connection was actually terminated
 * before a response went out (writableEnded false -- a real disconnect,
 * confirmed the same way: firing at the client's own abort time with
 * writableEnded still false). Only the latter should ever trigger an abort.
 */
export function abortSignalForRequest(req: Request, res: Response): AbortSignal {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
}
