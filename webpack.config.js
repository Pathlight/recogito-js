const path = require('path');
const fs = require('fs');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const APP_DIR = fs.realpathSync(process.cwd());

const resolveAppPath = relativePath => path.resolve(APP_DIR, relativePath);

module.exports = {
  entry: resolveAppPath('src'),
  output: {
    filename: 'recogito.js',
    library: 'Recogito',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  devtool: 'source-map',
  performance: {
    hints: false
  },
  optimization: {
    minimize: false,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  externals: {
    'react': {
      commonjs: 'react',
      commonjs2: 'react',
      amd: 'React',
      root: 'React'
    },
    'react-dom': {
      commonjs: 'react-dom',
      commonjs2: 'react-dom',
      amd: 'ReactDOM',
      root: 'ReactDOM'
    }    
  },
  module: {
    rules: [
      { 
        test: /\.(js|jsx)$/, 
        use: { 
          loader: 'babel-loader' ,
          options: {
            "presets": [
              "@babel/preset-env",
              "@babel/preset-react"
            ],
            "plugins": [
              [
                "@babel/plugin-proposal-class-properties"
              ]
            ]
          }
        }
      },
      { test: /\.css$/,  use: [ MiniCssExtractPlugin.loader, 'css-loader'] },
      { test: /\.scss$/, use: [ MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader' ] }
    ]
  },
  devServer: {
    compress: true,
    hot: true,
    host: process.env.HOST || 'localhost',
    port: 3000,
    static: {
      directory: resolveAppPath('public'),
      publicPath: '/'
    }
  },
  plugins: [
    new HtmlWebpackPlugin ({
      inject: 'head',
      template: resolveAppPath('public/index.html')
    }),
    new MiniCssExtractPlugin({
      filename: 'recogito.min.css',
    })
  ]
}