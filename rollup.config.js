import fs from 'fs-extra'
import path from 'path'

import ts from 'rollup-plugin-typescript2'
import dts from 'rollup-plugin-dts'
import babel from 'rollup-plugin-babel'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import { sizeSnapshot } from 'rollup-plugin-size-snapshot'

const root = process.platform === 'win32' ? path.resolve('/') : '/'
const external = id => !id.startsWith('.') && !id.startsWith(root)
const extensions = ['.tsx', '.ts', '.js']
const rewritePaths = path =>
  path.startsWith('shared') ? '@react-spring/' + path : path

// Every module in the "input" directory gets its own bundle.
export const multiBundle = ({
  input = 'src',
  output = 'dist',
  ...config
} = {}) =>
  fs.readdirSync(input).reduce(
    (configs, file) =>
      configs.concat(
        bundle({
          input: path.join(input, file),
          output: path.join(output, file.replace(/\.tsx?$/, '.js')),
          ...config,
        })
      ),
    []
  )

export const bundle = ({
  input = 'src/index.ts',
  output = 'dist/index.js',
  minify = false,
  sourcemap = true,
  sourcemapExcludeSources = true,
  sourceRoot = path.dirname(input),
} = {}) => {
  const config = {
    input,
    output,
    minify,
    sourcemap,
    sourcemapExcludeSources,
    sourceRoot,
  }
  return [esmBundle(config), cjsBundle(config), dtsBundle(config)]
}

export const esmBundle = config => ({
  input: config.input,
  output: {
    file: config.output,
    format: 'esm',
    paths: rewritePaths,
    sourcemap: config.sourcemap,
    sourcemapPathTransform: rewriteSourcePaths(config),
    sourcemapExcludeSources: config.sourcemapExcludeSources,
  },
  external,
  plugins: [
    resolve({ extensions }),
    ts({ check: false }),
    babel(getBabelOptions({ useESModules: true })),
    sizeSnapshot(),
    config.minify && terser(),
  ],
})

export const cjsBundle = config => ({
  input: config.input,
  output: {
    file: config.output.replace(/\.js$/, '.cjs.js'),
    format: 'cjs',
    paths: rewritePaths,
    sourcemap: config.sourcemap,
    sourcemapPathTransform: rewriteSourcePaths(config),
    sourcemapExcludeSources: config.sourcemapExcludeSources,
  },
  external,
  plugins: [
    resolve({ extensions }),
    ts({ check: false }),
    babel(getBabelOptions({ useESModules: false })),
    sizeSnapshot(),
    config.minify && terser(),
  ],
})

export const dtsBundle = config => ({
  input: config.input,
  output: [
    {
      file: config.output.replace(/\.js$/, '.d.ts'),
      format: 'es',
      paths: rewritePaths,
    },
  ],
  plugins: [dts()],
  external,
})

const babelExtensions = [
  ...require('@babel/core').DEFAULT_EXTENSIONS,
  'ts',
  'tsx',
]

export const getBabelOptions = ({ useESModules }) => ({
  babelrc: false,
  exclude: '**/node_modules/**',
  extensions: babelExtensions,
  runtimeHelpers: true,
  presets: [
    ['@babel/preset-env', { loose: true, modules: false }],
    '@babel/preset-react',
  ],
  plugins: [
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-proposal-object-rest-spread', { loose: true }],
    ['@babel/plugin-transform-runtime', { regenerator: false, useESModules }],
  ],
})

const rewriteSourcePaths = config => {
  const outToIn = path.relative(
    path.dirname(config.output),
    path.dirname(config.input)
  )
  return file =>
    path.join(config.sourceRoot || '', path.relative(outToIn, file))
}
