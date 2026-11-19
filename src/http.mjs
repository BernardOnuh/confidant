// Every outbound request (OpenRouter, Telegraph, truth sources, the x402 facilitator) goes through one connection pool.
// HTTP/1.1 only, with short keep-alive: the default pool reused HTTP/2 sessions the servers had
// already closed ("The session has been destroyed"), which failed every request after the first.
// If the system can't look a name up (some home routers drop lookups), public DNS servers are asked instead.
import dns from "node:dns";
import { Agent, setGlobalDispatcher } from "undici";

const fallback = new dns.promises.Resolver({ timeout: 4000, tries: 2 });
fallback.setServers(["1.1.1.1", "8.8.8.8"]);

function lookup(host, opts, cb) {
  dns.lookup(host, opts, (err, address, family) => {
    if (!err) return cb(null, address, family);
    fallback.resolve4(host).then(
      ips => (opts?.all ? cb(null, ips.map(a => ({ address: a, family: 4 }))) : cb(null, ips[0], 4)),
      () => cb(err),
    );
  });
}

setGlobalDispatcher(new Agent({ allowH2: false, keepAliveTimeout: 4000, keepAliveMaxTimeout: 10000, connections: 16, connect: { lookup } }));
