'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'i18n-auto.config.json';
const LOCK_FILE = '.i18n-auto.lock.json';

const DEFAULTS = {
    base: 'en',
    dir: 'locales',
    targets: null, // null = every *.json in dir except the base file
    langMap: {}, // { "en": "EN-GB" } to override DeepL target codes
    formality: {}, // "prefer_less" for all, or { "de": "prefer_more" }
    glossaries: {}, // { "de": "<deepl glossary id>" }
    context: '', // extra hint sent to DeepL, not translated or billed
    ignoreKeys: [], // ["brand.*", "legal.**"] copied from base, never translated
    indent: 2,
    prune: false,
};

function loadConfig(cwd, cli = {}) {
    const configPath = cli.config ? path.resolve(cwd, cli.config) : path.join(cwd, CONFIG_FILE);
    let fileConfig = {};
    let configDir = cwd;

    if (fs.existsSync(configPath)) {
        try {
            fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (err) {
            throw new Error(`Could not parse ${configPath}: ${err.message}`);
        }
        configDir = path.dirname(configPath);
    } else if (cli.config) {
        throw new Error(`Config file not found: ${configPath}`);
    }

    const config = { ...DEFAULTS, ...fileConfig };
    config.dir = path.resolve(configDir, config.dir);

    if (cli.base) config.base = cli.base;
    if (cli.dir) config.dir = path.resolve(cwd, cli.dir);
    if (cli.targets) config.targets = cli.targets.split(',').map((s) => s.trim()).filter(Boolean);
    if (cli.prune) config.prune = true;

    if (config.targets !== null && !Array.isArray(config.targets)) {
        throw new Error('"targets" must be an array of language codes.');
    }

    config.configPath = fs.existsSync(configPath) ? configPath : null;
    config.lockPath = path.join(config.dir, LOCK_FILE);
    return config;
}

function detectTargets(dir, base) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.json') && !f.startsWith('.'))
        .map((f) => f.slice(0, -5))
        .filter((lang) => lang !== base)
        .sort();
}

const formalityFor = (config, lang) =>
    typeof config.formality === 'string' ? config.formality : config.formality[lang];

module.exports = { loadConfig, detectTargets, formalityFor, CONFIG_FILE, LOCK_FILE, DEFAULTS };
