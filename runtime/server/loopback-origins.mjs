/** Exact local aliases, never a wildcard or a CORS exception. Each request must
 * originate from the same host spelling and port that it addresses. */
export function createLoopbackOriginPolicy(origin) {
  const match = /^http:\/\/(?:127\.0\.0\.1|localhost):([1-9]\d{0,4})$/.exec(origin);
  if (!match || Number(match[1]) > 65535) throw new Error('Expected an explicit HTTP loopback origin and port.');
  const hosts = new Map(['127.0.0.1', 'localhost'].map(host => [`${host}:${match[1]}`, `http://${host}:${match[1]}`]));
  return {
    origins: [...hosts.values()],
    resolve(req) {
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)) return null;
      const expected = hosts.get(req.headers.host);
      if (!expected) return null;
      if (req.headers.origin !== undefined && req.headers.origin !== expected) return null;
      if (req.headers['sec-fetch-site'] !== undefined && req.headers['sec-fetch-site'] !== 'same-origin') return null;
      return expected;
    },
  };
}
