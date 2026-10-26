import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadRoute, routeLength } from './assets/js/route.mjs';

const source = await readFile(new URL('./assets/js/main.js', import.meta.url), 'utf8');
const bytes = await readFile(new URL('./assets/geojson/ULBI PVJ.geojson', import.meta.url));
const data = JSON.parse(bytes);
assert.equal(routeLength([[0, 0], [0, 0]]), 0);
assert.ok(Math.abs(routeLength([[0, 0], [1, 0]]) - 111195.0802) < 0.1);
assert.equal(await loadRoute(async () => ({ ok: true, json: async () => data })), data);
assert.ok(routeLength(data.features[0].geometry.coordinates) > 5000);
await assert.rejects(loadRoute(async () => ({ ok: false, status: 404 })), /HTTP 404/);
await assert.rejects(loadRoute(async () => ({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) })), /LineString/);
await assert.rejects(loadRoute(async () => ({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [{ geometry: { type: 'LineString', coordinates: [[107, -6], [107, 100]] } }] }) })), /Koordinat/);
assert.equal(new URL('../geojson/ULBI PVJ.geojson', 'https://example.github.io/project/assets/js/main.js').href, 'https://example.github.io/project/assets/geojson/ULBI%20PVJ.geojson');
console.log('PASS: panjang rute, dataset, HTTP gagal, data invalid, dan path GitHub Pages.');

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
assert.ok(!/<style\b|\s(?:style|on[\w-]+)\s*=/i.test(html), 'HTML tidak boleh berisi CSS atau event inline.');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length, 1);
assert.ok(scripts[0][1].includes('type="module"') && scripts[0][1].includes('src="./assets/js/main.js"'));
assert.equal(scripts[0][2].trim(), '');
const imports = [...source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)].map(match => match[1]);
assert.deepEqual(imports, ['https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.16/map.min.js']);
assert.ok(!/\.style\b/.test(source), 'Styling aplikasi harus memakai kelas CSS.');
console.log('PASS: konvensi HTML/CSS/ES Modules dan import eksternal hanya CrootJS.');
