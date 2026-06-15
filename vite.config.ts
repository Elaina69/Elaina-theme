import { resolve, join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile, cp, mkdir, rm } from 'node:fs/promises';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import fs from 'node:fs';
import archiver from "archiver"
import chalk from 'chalk';

import pkg from './package.json';
const PLUGINS_PATH = pkg.config.pluginsPath;
const PLUGIN_NAME = pkg.folderName;
const Author = 
`/**
* @name ${pkg.pluginName}
* @author ${pkg.author.name}
* @description ${pkg.description}
* @link https://github.com/${pkg.author.github}
* @Nyan Meow~~~
*/
`;

const getIndexCode = (port: number) => (
    `await import('https://localhost:${port}/@vite/client');
    export * from 'https://localhost:${port}/src/index.ts';`
);

let port: number;
const outDir = resolve(__dirname, 'dist');
const pluginsDir = resolve(__dirname, PLUGINS_PATH, PLUGIN_NAME);

async function emptyDir(path: string) {
    if (existsSync(path)) {
        await rm(path, { recursive: true });
    }
    await mkdir(path, { recursive: true });
}

export default defineConfig((config) => ({
    define: {
        'process.env.ENV': config.command == 'build' ? '"production"' : '"development"',
        'process.env.PROD': config.command == 'build' ? 'true' : 'false',
        'process.env.DEV': config.command == 'build' ? 'false' : 'true',
    },
    build: {
        target: 'esnext',
        minify: false,
        cssMinify: false,
        rollupOptions: {
            output: {
                format: 'esm',
                entryFileNames: 'index.js',
                manualChunks: undefined,
                assetFileNames(name) {
                    if (name.name === 'style.css')
                        return 'index.css';
                    return 'assets/[name]-[hash][extname]';
                }
            },
            preserveEntrySignatures: 'strict',
            treeshake: 'smallest',
        },
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            fileName: 'index',
            formats: ['es'],
        },
    },
    publicDir: false,
    plugins: [
        mkcert(),
        // {
        //     // Because vite doesn't allow minifying of ESM, we have to do it manually
        //     name: 'minify',
        //     apply: 'build',
        //     enforce: 'post',
        //     renderChunk: {
        //         order: 'post',
        //         async handler(code, chunk, _) {
        //             if (chunk.fileName.endsWith('.js')) {
        //                 return await transform(code, { minify: true, treeShaking: true });
        //             }

        //             return code;
        //         }
        //     }
        // },
        {
            name: 'pengu-serve',
            apply: 'serve',
            enforce: 'post',
            configureServer(server) {
                server.httpServer!.once('listening', async () => {
                    // @ts-ignore
                    port = server.httpServer.address()['port'];
                    await emptyDir(pluginsDir);
                    await writeFile(join(pluginsDir, 'index.js'), getIndexCode(port));
                });
            },
            transform: (code, id) => {
                if (/\.(ts|tsx|js|jsx)$/i.test(id)) return;
                return code.replace(/\/src\//g, `https://localhost:${port}/src/`)
            },
        },
        {
            name: 'pengu-build',
            apply: 'build',
            enforce: 'post',
            async closeBundle() {
                const now = new Date();
                console.log(chalk.cyan("Build at: ") + now.toLocaleString());
            
                const indexJs = join(outDir, 'index.js');
                let count = 0;
            
                // Read and patch index.js
                let jsCode = (await readFile(indexJs, 'utf-8'))
                    .replace(/"\/assets\//g, `"//plugins/${PLUGIN_NAME}/assets/`);
            
                // Patch index.css if exists
                if (existsSync(join(outDir, 'index.css'))) {
                    const indexCss = join(outDir, 'index.css');
                    const cssCode = (await readFile(indexCss, 'utf-8'))
                        .replace(/url\(\/assets\//g, `url(./assets/`);
                    await writeFile(indexCss, cssCode);
            
                    // Import CSS module in index.js
                    jsCode = `import "./index.css";\n${jsCode}`;
                }
            
                await writeFile(indexJs, jsCode);
                
                async function prependCommentToFile(filePath: string, commentBlock: string, lineNumber: number) {
                    try {
                        if (!existsSync(filePath)) {
                            console.error(chalk.red(`File not found: ${filePath}`));
                            return;
                        }

                        const data = await readFile(filePath, 'utf-8');
                        const lines = data.split('\n');
                        lines.splice(lineNumber - 1, 0, commentBlock.trim());
                        const updatedContent = lines.join('\n');
                        await writeFile(filePath, updatedContent, 'utf-8');
                        // console.log(chalk.green('✔ Comment added successfully!'));
                    } catch (err) {
                        console.error(chalk.red('Error while processing the file:'), err);
                    }
                }
            
                await prependCommentToFile(indexJs, Author, 1);
            
                // Copy assets and config folders
                const copyTask = async (src: string, dest: string | URL, taskName: string) => {
                    count = 0;
                    const interval = setInterval(() => count += 100, 100);
            
                    try {
                        await cp(resolve(__dirname, src), dest, { recursive: true });
                        console.log(chalk.green(`✔ ${taskName} completed! (in ${count / 1000}s)`));
                    } catch (err) {
                        console.error(chalk.red(`Error in ${taskName}:`), err);
                    } finally {
                        clearInterval(interval);
                        count = 0;
                    }
                };
            
                await copyTask('src/src/assets', join(outDir, 'assets'), 'Copying assets folder to /dist');
                await copyTask('src/src/config', join(outDir, 'config'), 'Copying config folder to /dist');
                await copyTask('src/src/locales', join(outDir, 'locales'), 'Copying locales folder to /dist');
            
                try {
                    await copyTask('src/elaina-theme-data', join(outDir, 'elaina-theme-data'), 'Copying CDN folder to /dist');
                } catch (err) {
                    // Silently fail if the directory doesn't exist
                }
            
                // Zip plugins
                count = 0;
                const interval = setInterval(() => count += 100, 100);
                try {
                    const output = fs.createWriteStream(join(outDir, `${pkg.folderName}.zip`));
                    const archive = archiver('zip', { zlib: { level: 9 } });
            
                    archive.on('error', (err) => {
                        throw err;
                    });
            
                    output.on('close', () => {
                        console.log(chalk.cyan(`${archive.pointer()} total bytes`));
                    });
            
                    archive.pipe(output);
                    archive.directory(join(outDir, 'assets'), "assets");
                    archive.directory(join(outDir, 'config'), "config");
                    archive.directory(join(outDir, 'locales'), 'locales');
                    archive.file(indexJs, { name: basename(indexJs) });
            
                    await archive.finalize();
                    console.log(chalk.green(`✔ Zipping completed successfully! (in ${count / 1000}s)`));
                } catch (err) {
                    console.error(chalk.red('Error while zipping:'), err);
                } finally {
                    clearInterval(interval);
                    count = 0;
                }
            
                // Copy output to Pengu directory
                count = 0;
                const penguInterval = setInterval(() => count += 100, 100);
                try {
                    await emptyDir(pluginsDir);
                    await cp(outDir, pluginsDir, { recursive: true });
                    console.log(chalk.green(`✔ Copy output to pengu dir completed! (in ${count / 1000}s)`));
                } catch (err) {
                    console.error(chalk.red('Error while copying to Pengu directory:'), err);
                } finally {
                    clearInterval(penguInterval);
                    count = 0;
                }
            }
        },
    ]
}));
