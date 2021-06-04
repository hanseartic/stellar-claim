const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
    entry: {
        index: './src/index.js',
        header: '/src/header.js',
        account: './src/account.js',
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new HtmlWebpackPlugin({
            title: 'Grab all your stellar claimables',
        }),
    ],
    resolveLoader: {
        modules: [path.resolve(__dirname, 'node_modules')],
    },
    resolve: {
        fallback: {
            http: false,
            https: false,
            url: require.resolve("url/"),
            util: require.resolve("util/"),
        }
    }
}