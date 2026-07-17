import { cp, mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');

await writeFile('dist/server/index.js', `
export default {
  async fetch(request, env) {
    if (env?.ASSETS?.fetch) return env.ASSETS.fetch(request);
    return new Response('Tiny Signal is ready.', {
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
};
`);
