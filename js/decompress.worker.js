/**
 * File: js/decompress.worker.js
 * Purpose: Worker that decompresses gzip ArrayBuffer payloads using DecompressionStream.
 *
 * Protocol:
 *  - postMessage({ type: 'decompress', buffer: ArrayBuffer })
 *  - worker replies with postMessage({ ok: true, text: string }) or { ok: false, error: string }
 */

/**
 * Worker message handler - performs gzip decompression using DecompressionStream.
 * @param {MessageEvent} e
 */
self.addEventListener('message', async (e) => {
  const msg = e.data;
  if (!msg || msg.type !== 'decompress') return;
  try {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('DecompressionStream not supported in this environment');
    }
    /** @type {ArrayBuffer} */
    const ab = msg.buffer;
    // Create a blob from the transferred ArrayBuffer and pipe through DecompressionStream
    const blob = new Blob([ab]);
    const ds = new DecompressionStream('gzip');
    const stream = blob.stream().pipeThrough(ds);
    const text = await new Response(stream).text();
    self.postMessage({ ok: true, text });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
});