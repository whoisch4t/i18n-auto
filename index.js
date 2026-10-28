#!/usr/bin/env node
'use strict';

const { parseArgs } = require('util');
const pkg = require('./package.json');
const { loadConfig, CONFIG_FILE } = require('./lib/config');
const { run } = require('./lib/run');

require('dotenv').config({ quiet: true });

const asciiArt = `
 __        __  _   _   ___   ___  ____   ____  _   _     _  _____
 \\ \\      / / | | | | / _ \\ |_ _|/ ___| / ___|| | | |   / \\|_   _|
  \\ \\ /\\ / /  | |_| || | | | | | \\___ \\| |    | |_| |  / _ \\ | |
   \\ V  V /   |  _  || |_| | | |  ___) | |___ |  _  | / ___ \\| |
    \\_/\\_/    |_| |_| \\___/ |___||____/ \\____||_| |_|/_/   \\_\\_|
`;

const HELP = `
i18n-auto v${pkg.version}
Sync and translate i18n JSON files with DeepL.

Usage: i18n-auto [options]

Options:
  -b, --base <lang>       Source language file name (default: en)
  -t, --targets <list>    Comma-separated target languages (default: every *.json in dir)
  -d, --dir <path>        Locales directory (default: ./locales)
  -c, --config <file>     Config file (default: ./${CONFIG_FILE})
      --dry-run           Show what would be translated, write nothing
      --check             Exit with code 1 if anything is missing or outdated (for CI)
      --prune             Remove keys that no longer exist in the base file
      --force             Retranslate every string
  -q, --quiet             No banner, only warnings and errors
  -h, --help              Show this help
  -v, --version           Show version

Environment:
  DEEPL_API_KEY           Your DeepL API key (also read from .env)
`;

function main() {
    let args;
    try {
        args = parseArgs({
            options: {
                base: { type: 'string', short: 'b' },
                targets: { type: 'string', short: 't' },
                dir: { type: 'string', short: 'd' },
                config: { type: 'string', short: 'c' },
                'dry-run': { type: 'boolean' },
                check: { type: 'boolean' },
                prune: { type: 'boolean' },
                force: { type: 'boolean' },
                quiet: { type: 'boolean', short: 'q' },
                help: { type: 'boolean', short: 'h' },
                version: { type: 'boolean', short: 'v' },
            },
        }).values;
    } catch (err) {
        console.error(`[ERROR] ${err.message}\nRun i18n-auto --help for usage.`);
        return Promise.resolve(1);
    }

    if (args.help) {
        console.log(HELP);
        return Promise.resolve(0);
    }
    if (args.version) {
        console.log(pkg.version);
        return Promise.resolve(0);
    }

    const quiet = args.quiet;
    const log = {
        plain: (m) => !quiet && console.log(m),
        info: (m) => !quiet && console.log(`[INFO] ${m}`),
        success: (m) => !quiet && console.log(`[SUCCESS] ${m}`),
        warn: (m) => console.warn(`[WARN] ${m}`),
        error: (m) => console.error(`[ERROR] ${m}`),
    };

    let config;
    try {
        config = loadConfig(process.cwd(), args);
    } catch (err) {
        log.error(err.message);
        return Promise.resolve(1);
    }

    if (!quiet) console.log(asciiArt);

    let translator = null;
    const getTranslate = () => {
        if (translator) return translator.translate;
        const key = process.env.DEEPL_API_KEY;
        if (!key || key === 'YOUR_DEEPL_API_KEY') {
            throw new Error('DEEPL_API_KEY is not set. Add it to your environment or a .env file.');
        }
        const deepl = require('deepl-node');
        const { createTranslator } = require('./lib/translator');
        const client = new deepl.Translator(key);
        translator = { client, translate: createTranslator(client) };
        return translator.translate;
    };

    return run(config, { check: args.check, dryRun: args['dry-run'], force: args.force }, { getTranslate, log })
        .then(async (code) => {
            if (translator && !quiet) {
                try {
                    const usage = await translator.client.getUsage();
                    if (usage.character) {
                        log.info(`DeepL usage: ${usage.character.count.toLocaleString()} / ${usage.character.limit.toLocaleString()} characters this period.`);
                    }
                } catch {
                    // Usage is nice to have; ignore errors.
                }
            }
            return code;
        });
}

main()
    .then((code) => {
        process.exitCode = code;
    })
    .catch((err) => {
        console.error(`[ERROR] ${err.stack || err.message}`);
        process.exitCode = 1;
    });
