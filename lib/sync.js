'use strict';

const crypto = require('crypto');

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

const keyOf = (path) => path.join('.');

function compileIgnore(patterns = []) {
    const regexes = patterns.map((p) => new RegExp('^' + p
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '\u0000')
        .replace(/\*/g, '[^.]*')
        .replace(/\u0000/g, '.*') + '$')); // eslint-disable-line no-control-regex
    return (key) => regexes.some((r) => r.test(key));
}

function plan(base, target, { lock = {}, force = false, prune = false, ignore = () => false } = {}) {
    const ctx = { jobs: [], orphans: [], copied: 0, lock: {} };

    const walk = (b, t, path) => {
        if (isPlainObject(b)) {
            const tObj = isPlainObject(t) ? t : {};
            const out = {};
            for (const k of Object.keys(b)) out[k] = walk(b[k], tObj[k], [...path, k]);
            for (const k of Object.keys(tObj)) {
                if (Object.prototype.hasOwnProperty.call(b, k)) continue;
                ctx.orphans.push(keyOf([...path, k]));
                if (!prune) out[k] = tObj[k];
            }
            return out;
        }

        if (Array.isArray(b)) {
            const tArr = Array.isArray(t) ? t : [];
            return b.map((v, i) => walk(v, tArr[i], [...path, i]));
        }

        if (typeof b !== 'string') {
            if (t === undefined) {
                ctx.copied++;
                return b;
            }
            return t;
        }

        const key = keyOf(path);
        const hasTarget = typeof t === 'string' && t !== '';

        if (b.trim() === '' || ignore(key)) {
            if (hasTarget) return t;
            ctx.copied++;
            return b;
        }

        const h = hash(b);
        const prev = lock[key];
        if (hasTarget && !force && (prev === undefined || prev === h)) {
            ctx.lock[key] = h;
            return t;
        }

        ctx.jobs.push({
            path,
            key,
            source: b,
            reason: !hasTarget ? 'missing' : force ? 'forced' : 'changed',
        });
        return hasTarget ? t : null;
    };

    const output = walk(base, target, []);
    return { output, ...ctx };
}

function setAt(obj, path, value) {
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
    cur[path[path.length - 1]] = value;
}

function deleteAt(obj, path) {
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
    const last = path[path.length - 1];
    if (Array.isArray(cur)) cur[last] = '';
    else delete cur[last];
}

module.exports = { plan, setAt, deleteAt, hash, compileIgnore };
