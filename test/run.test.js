'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../lib/run');
const { loadConfig } = require('../lib/config');
const { createTranslator } = require('../lib/translator');

const silent = { plain() {}, info() {}, success() {}, warn() {}, error() {} };

function fakeClient(calls = []) {
    return {
        async translateText(texts, source, target, options) {
            calls.push({ texts, source, target, options });
            return texts.map((t) => ({ text: `[${target}] ${t}` }));
        },
    };
}

function setup(files, configFile) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-auto-'));
    fs.mkdirSync(path.join(dir, 'locales'));
    for (const [name, data] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, 'locales', name), JSON.stringify(data, null, 2) + '\n');
    }
    if (configFile) fs.writeFileSync(path.join(dir, 'i18n-auto.config.json'), JSON.stringify(configFile));
    const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, 'locales', name), 'utf8'));
    return { dir, read };
}

test('translates missing keys, keeps placeholders and writes a lock', async () => {
    const { dir, read } = setup({ 'en.json': { hi: 'Hello {name}', ok: 'OK' }, 'tr.json': { ok: 'Tamam' } });
    const calls = [];
    const translate = createTranslator(fakeClient(calls));
    const code = await run(loadConfig(dir), {}, { getTranslate: () => translate, log: silent });

    assert.equal(code, 0);
    assert.deepEqual(read('tr.json'), { hi: '[TR] Hello {name}', ok: 'Tamam' });
    assert.equal(calls[0].source, 'EN');
    assert.equal(calls[0].options.tagHandling, 'xml');
    const lock = JSON.parse(fs.readFileSync(path.join(dir, 'locales', '.i18n-auto.lock.json'), 'utf8'));
    assert.deepEqual(Object.keys(lock.languages.tr).sort(), ['hi', 'ok']);
});

test('retranslates a key after its source text changes', async () => {
    const { dir, read } = setup({ 'en.json': { hi: 'Hello' }, 'tr.json': {} });
    const translate = createTranslator(fakeClient());
    await run(loadConfig(dir), {}, { getTranslate: () => translate, log: silent });

    fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify({ hi: 'Hello again' }));
    await run(loadConfig(dir), {}, { getTranslate: () => translate, log: silent });
    assert.equal(read('tr.json').hi, '[TR] Hello again');
});

test('--check exits 1 without calling the API', async () => {
    const { dir } = setup({ 'en.json': { a: 'A' }, 'de.json': {} });
    const getTranslate = () => assert.fail('API should not be called');
    assert.equal(await run(loadConfig(dir), { check: true }, { getTranslate, log: silent }), 1);
});

test('--dry-run writes nothing', async () => {
    const { dir, read } = setup({ 'en.json': { a: 'A' }, 'de.json': {} });
    const getTranslate = () => assert.fail('API should not be called');
    assert.equal(await run(loadConfig(dir), { dryRun: true }, { getTranslate, log: silent }), 0);
    assert.deepEqual(read('de.json'), {});
    assert.ok(!fs.existsSync(path.join(dir, 'locales', '.i18n-auto.lock.json')));
});

test('a broken placeholder leaves the key missing and returns 1', async () => {
    const { dir, read } = setup({ 'en.json': { hi: 'Hello {name}', ok: 'OK' }, 'tr.json': {} });
    const client = { async translateText(texts) { return texts.map((t) => ({ text: t.replace(/<x[^>]*>/g, '') })); } };
    const code = await run(loadConfig(dir), {}, { getTranslate: () => createTranslator(client), log: silent });
    assert.equal(code, 1);
    assert.deepEqual(read('tr.json'), { ok: 'OK' });
});

test('an API error returns 1 and leaves the file untouched', async () => {
    const { dir, read } = setup({ 'en.json': { a: 'A' }, 'tr.json': { old: 'x' } });
    const getTranslate = () => async () => { throw new Error('quota exceeded'); };
    assert.equal(await run(loadConfig(dir), {}, { getTranslate, log: silent }), 1);
    assert.deepEqual(read('tr.json'), { old: 'x' });
});

test('reads targets, formality and language map from the config file', async () => {
    const { dir } = setup(
        { 'en.json': { a: 'A' } },
        { targets: ['de', 'pt'], formality: { de: 'prefer_less' } },
    );
    const calls = [];
    const translate = createTranslator(fakeClient(calls));
    assert.equal(await run(loadConfig(dir), {}, { getTranslate: () => translate, log: silent }), 0);
    assert.deepEqual(calls.map((c) => [c.target, c.options.formality]), [['DE', 'prefer_less'], ['PT-BR', undefined]]);
});

test('splits large files into batches of 50', async () => {
    const base = Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`k${i}`, `Text ${i}`]));
    const { dir, read } = setup({ 'en.json': base, 'tr.json': {} });
    const calls = [];
    const translate = createTranslator(fakeClient(calls));
    await run(loadConfig(dir), {}, { getTranslate: () => translate, log: silent });
    assert.deepEqual(calls.map((c) => c.texts.length), [50, 50, 20]);
    assert.equal(read('tr.json').k119, '[TR] Text 119');
});
