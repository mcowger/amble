const paseoRelayE2eePath = Bun.resolveSync("@getpaseo/relay/e2ee", import.meta.dir);

export const paseoRelayExportWorkaround: Bun.BunPlugin = {
  name: "paseo-relay-export-workaround",
  target: "browser",
  setup(build) {
    build.onResolve({ filter: /^@getpaseo\/relay\/e2ee$/ }, () => ({
      path: paseoRelayE2eePath,
    }));
  },
};
