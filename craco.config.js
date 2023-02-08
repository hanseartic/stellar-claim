const webpack = require("webpack");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  devServer: {
    open: false,
    devMiddleware: {
//      writeToDisk: true,
    }
  },
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
        new NodePolyfillPlugin({includeAliases:[
          "assert",
          "http",
          "https",
          "url"
        ]})
      ]
    }
  }
}
