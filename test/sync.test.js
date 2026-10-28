'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { plan, hash, compileIgnore } = require('../lib/sync');
const { toTargetCode, toSourceCode } = require('../lib/translator');

test('finds missing and empty keys, keeps existing ones', () => {
    const base = { a: 'A', b: 'B', nested: { c: 'C' } };
    const target = { a: 'a-tr', b: '' };
    const p = plan(base, target);
    assert.deepEqual(p.jobs.map((j) => [j.key, j.reason]), [['b', 'missing'], ['nested.c', 'missing']]);
    assert.equal(p.output.a, 'a-tr');
});

test('follows the base key order', () => {
    const p = plan({ x: '1', y: '2', z: '3' }, { z: 'z', x: 'x', y: 'y' });
    assert.deepEqual(Object.keys(p.output), ['x', 'y', 'z']);
});

test('treats keys with dots as single keys', () => {
    const p = plan({ 'v1.0': 'Version one' }, { 'v1.0': 'Sürüm bir' });
    assert.deepEqual(p.output, { 'v1.0': 'Sürüm bir' });
    assert.equal(p.jobs.length, 0);
});

test('translates arrays item by item', () => {
    const p = plan({ list: ['One', 'Two'] }, { list: ['Bir'] });
    assert.deepEqual(p.jobs.map((j) => j.path), [['list', 1]]);
    assert.deepEqual(p.output.list, ['Bir', null]);
});

test('detects changed source text through the lock', () => {
    const lock = { greet: hash('Hello') };
    const p = plan({ greet: 'Hello there' }, { greet: 'Merhaba' }, { lock });
    assert.deepEqual(p.jobs.map((j) => j.reason), ['changed']);
    assert.equal(p.output.greet, 'Merhaba');
});

test('adopts existing translations when there is no lock entry yet', () => {
    const p = plan({ greet: 'Hello' }, { greet: 'Merhaba' });
    assert.equal(p.jobs.length, 0);
    assert.equal(p.lock.greet, hash('Hello'));
});

test('reports orphans and removes them only with prune', () => {
    const base = { keep: 'K' };
    const target = { keep: 'k', old: 'o', grp: { gone: 'g' } };
    const kept = plan(base, target);
    assert.deepEqual(kept.orphans, ['old', 'grp']);
    assert.equal(kept.output.old, 'o');
    const pruned = plan(base, target, { prune: true });
    assert.deepEqual(pruned.output, { keep: 'k' });
});

test('ignored keys are copied from base, not translated', () => {
    const ignore = compileIgnore(['brand.*']);
    const p = plan({ brand: { name: 'whoischat' }, hi: 'Hi' }, {}, { ignore });
    assert.equal(p.output.brand.name, 'whoischat');
    assert.deepEqual(p.jobs.map((j) => j.key), ['hi']);
    assert.equal(p.copied, 1);
});

test('glob patterns: * stays in one level, ** goes deeper', () => {
    const one = compileIgnore(['a.*']);
    assert.ok(one('a.b'));
    assert.ok(!one('a.b.c'));
    const deep = compileIgnore(['a.**']);
    assert.ok(deep('a.b.c'));
});

test('force retranslates everything', () => {
    const p = plan({ a: 'A' }, { a: 'x' }, { force: true });
    assert.deepEqual(p.jobs.map((j) => j.reason), ['forced']);
});

test('maps file names to DeepL language codes', () => {
    assert.equal(toTargetCode('tr'), 'TR');
    assert.equal(toTargetCode('en'), 'EN-US');
    assert.equal(toTargetCode('pt_BR'), 'PT-BR');
    assert.equal(toTargetCode('zh-TW'), 'ZH-HANT');
    assert.equal(toTargetCode('en', { en: 'EN-GB' }), 'EN-GB');
    assert.equal(toSourceCode('en-GB'), 'EN');
});
