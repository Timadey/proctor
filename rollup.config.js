import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
    input: 'src/index.js',
    output: [
        {
            file: 'dist/index.js',
            format: 'cjs',
            sourcemap: true,
            exports: 'named',
        },
        {
            file: 'dist/index.esm.js',
            format: 'esm',
            sourcemap: true,
            exports: 'named',
        },
    ],
    plugins: [
        resolve({
            extensions: ['.js'],
        }),
        babel({
            exclude: 'node_modules/**',
            presets: [
                ['@babel/preset-env', {
                    targets: { browsers: ['>0.25%', 'not dead'] },
                    modules: false
                }]
            ],
            babelHelpers: 'bundled',
        }),
        commonjs(),
        terser(),
    ],
    external: [
        '@mediapipe/tasks-vision'
    ],
};