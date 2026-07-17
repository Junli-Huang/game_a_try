import { access, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

try {
  await access('.openai/hosting.json');
} catch {
  // GitHub Pages only needs Vite's static output.
  process.exit(0);
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8'
};

async function collect(directory) {
  const files = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'server' || entry.name === '.openai') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(files, await collect(path));
    else {
      const url = '/' + relative('dist', path).split(sep).join('/');
      const extension = url.slice(url.lastIndexOf('.'));
      files[url] = {
        body: await readFile(path, 'utf8'),
        type: mimeTypes[extension] || 'text/plain; charset=utf-8'
      };
    }
  }
  return files;
}

const assets = await collect('dist');
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');

await writeFile('dist/server/index.js', `
const assets = ${JSON.stringify(assets)};

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const asset = assets[path] || assets['/index.html'];
    return new Response(asset.body, {
      headers: {
        'content-type': asset.type,
        'cache-control': path === '/' ? 'no-cache' : 'public, max-age=31536000, immutable'
      }
    });
  }
};
`);
