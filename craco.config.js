const webpack = require("webpack");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");


module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
        }
      },
      plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new NodePolyfillPlugin({excludeAliases:[
          //"assert",
          //"http",
          //"https",
          //"url",
          "buffer",
          "console",
          "constants",
          "crypto",
          "domain",
          "events",
          "os",
          "path",
          "punycode",
          "process",
          "querystring",
          "stream",
          "_stream_duplex",
          "_stream_passthrough",
          "_stream_readable",
          "_stream_transform",
          "_stream_writable",
          "string_decoder",
          "sys",
          "timers",
          "tty",
          "util",
          "vm",
          "zlib"
        ]})
      ]
    }
  }
}
