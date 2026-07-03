/* eslint-disable @typescript-eslint/no-var-requires, no-undef */
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const path = require("path");
const _resolve = (_path) => path.resolve(__dirname, _path);

module.exports = {
  mode: "development",
  entry: {
    index: _resolve("../examples/index.ts"),
  },
  output: {
    filename: "[name].js",
    path: _resolve("../dist-dev"),
  },
  devServer: {
    port: 8080,
    host: "0.0.0.0",
    static: {
      directory: _resolve("../dist-dev"),
    },
    allowedHosts: [
      ".mazey.net",
    ],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: _resolve("../dist-dev/index.html"),
      template: _resolve("../examples/index.html"),
      inject: true,
    }),
    new CleanWebpackPlugin({ cleanOnceBeforeBuildPatterns: [ _resolve("../dist-dev") ] }),
  ],
  resolve: {
    extensions: [ ".tsx", ".ts", ".js" ],
  },
};
