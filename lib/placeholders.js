'use strict';

const PLACEHOLDER_RE = /\{\{[^{}]*\}\}|\{[^{}]*\}|%(?:\d+\$)?[sdifoxX@]|%\([^)]+\)[sdif]|\$t\([^)]*\)|<\/?[A-Za-z][^<>]*>/g;

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const unescapeXml = (s) => s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

function protect(text) {
    const tokens = [];
    let out = '';
    let last = 0;
    for (const match of text.matchAll(PLACEHOLDER_RE)) {
        out += escapeXml(text.slice(last, match.index));
        out += `<x i="${tokens.length}"/>`;
        tokens.push(match[0]);
        last = match.index + match[0].length;
    }
    out += escapeXml(text.slice(last));
    return { text: out, tokens };
}

function restore(translated, tokens) {
    const seen = new Array(tokens.length).fill(0);
    const out = translated.replace(/<x i="(\d+)"\s*\/>|<x i="(\d+)"\s*><\/x>/g, (_, a, b) => {
        const i = Number(a ?? b);
        if (i >= tokens.length) return '';
        seen[i]++;
        return `\u0000${i}\u0000`;
    });
    const missing = tokens.filter((_, i) => seen[i] !== 1);
    if (missing.length) {
        throw new Error(`placeholder mismatch: ${missing.join(', ')}`);
    }
    return unescapeXml(out).replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]); // eslint-disable-line no-control-regex
}

module.exports = { protect, restore, PLACEHOLDER_RE };
