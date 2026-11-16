// Every outbound request (OpenRouter, Telegraph, truth sources) goes through one connection pool.
// HTTP/1.1 only, with short keep-alive: the default pool reused HTTP/2 sessions the servers had
// already closed ("The session has been destroyed"), which failed every request after the first.
import { Agent, setGlobalDispatcher } from "undici";

setGlobalDispatcher(new Agent({ allowH2: false, keepAliveTimeout: 4000, keepAliveMaxTimeout: 10000, connections: 16 }));
