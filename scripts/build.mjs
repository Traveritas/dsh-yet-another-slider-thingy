/**
 * 把 src/client.js + src/style.css + src/pixel-flow.js 包成 dsh 客户端模块格式的 lib/client.js。
 *
 * - __CSS__：替换成样式表的 JSON 字符串（浏览器端注入 <style>）。
 * - __PIXEL_FLOW__：替换成像素流光那个纯函数文件（预览页也直接引它，一份代码两处用）。
 * - banner / intro / footer：注册 factory，提供 CJS 的 module / exports；
 *   factory 返回 { inject, apply }。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const source = readFileSync(resolve(root, 'src/client.js'), 'utf8');
const css = readFileSync(resolve(root, 'src/style.css'), 'utf8');
const pixelFlow = readFileSync(resolve(root, 'src/pixel-flow.js'), 'utf8');

if (!source.includes('__CSS__')) throw new Error('src/client.js is missing the __CSS__ placeholder');
if (!source.includes('__PIXEL_FLOW__')) throw new Error('src/client.js is missing the __PIXEL_FLOW__ placeholder');

let body = source.replace('__CSS__', () => JSON.stringify(css));
if (body.includes('__CSS__')) throw new Error('__CSS__ placeholder appears more than once');
body = body.replace('__PIXEL_FLOW__', () => pixelFlow);
if (body.includes('__PIXEL_FLOW__')) throw new Error('__PIXEL_FLOW__ placeholder appears more than once');

if (!body.includes('module.exports')) throw new Error('src/client.js does not export { inject, apply }');

const bundle = [
  `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`,
  'var module = { exports: {} }; var exports = module.exports;',
  body,
  'return module.exports;',
  '} });',
  '',
].join('\n');

mkdirSync(resolve(root, 'lib'), { recursive: true });
writeFileSync(resolve(root, 'lib/client.js'), bundle);
console.log(`built lib/client.js (${Buffer.byteLength(bundle)} bytes)`);
