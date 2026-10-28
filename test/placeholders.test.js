'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { protect, restore } = require('../lib/placeholders');

test('protects common placeholder styles', () => {
    const src = 'Hi {{name}}, you have {count} items, %s and %1$d, %(user)s, $t(common.ok)';
    const { text, tokens } = protect(src);
    assert.deepEqual(tokens, ['{{name}}', '{count}', '%s', '%1$d', '%(user)s', '$t(common.ok)']);
    assert.ok(!text.includes('{'));
    assert.equal(restore(text, tokens), src);
});

test('protects inline HTML and escapes stray XML characters', () => {
    const src = 'Click <b>here</b> & save <br/> 5 < 6';
    const { text, tokens } = protect(src);
    assert.deepEqual(tokens, ['<b>', '</b>', '<br/>']);
    assert.match(text, /&amp;/);
    assert.match(text, /5 &lt; 6/);
    assert.equal(restore(text, tokens), src);
});

test('restores placeholders that DeepL moved around', () => {
    const { tokens } = protect('{a} before {b}');
    assert.equal(restore('<x i="1"/> önce <x i="0"/>', tokens), '{b} önce {a}');
});

test('throws when a placeholder is lost or duplicated', () => {
    const { tokens } = protect('Hello {name} and {other}');
    assert.throws(() => restore('Merhaba <x i="0"/>', tokens), /placeholder mismatch/);
    assert.throws(() => restore('<x i="0"/> <x i="0"/> <x i="1"/>', tokens), /placeholder mismatch/);
});

test('leaves plain text alone', () => {
    const { text, tokens } = protect('Just text');
    assert.equal(text, 'Just text');
    assert.deepEqual(tokens, []);
});
