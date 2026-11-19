/** @type {import('next').NextConfig} */
export default {
  // Server-only libraries that should load from node_modules as they are, not be bundled.
  serverExternalPackages: ["undici", "viem", "@x402/fetch", "@x402/evm"],
  poweredByHeader: false,
};
