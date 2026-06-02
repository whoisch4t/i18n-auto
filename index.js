#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const deepl = require('deepl-node');
require('dotenv').config();

const asciiArt = `
 __        __  _   _   ___   ___  ____   ____  _   _     _  _____
 \\ \\      / / | | | | / _ \\ |_ _|/ ___| / ___|| | | |   / \\|_   _|
  \\ \\ /\\ / /  | |_| || | | | | | \\___ \\| |    | |_| |  / _ \\ | |
   \\ V  V /   |  _  || |_| | | |  ___) | |___ |  _  | / ___ \\| |
    \\_/\\_/    |_| |_| \\___/ |___||____/ \\____||_| |_|/_/   \\_\\_|
`;

const DEEPL_API_KEY = process.env.DEEPL_API_KEY || 'YOUR_DEEPL_API_KEY';
const BASE_LANG = 'en';
const TARGET_LANGS = ['tr', 'ru', 'el', 'ar', 'fa'];
const LOCALES_DIR = path.join(__dirname, 'locales');

const translator = new deepl.Translator(DEEPL_API_KEY);

const flatten = (obj, prefix = '') => {
    return Object.keys(obj).reduce((acc, k) => {
        const pre = prefix.length ? prefix + '.' : '';
        if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
            Object.assign(acc, flatten(obj[k], pre + k));
        } else {
            acc[pre + k] = obj[k];
        }
        return acc;
    }, {});
};

const unflatten = (obj) => {
    const result = {};
    for (const key in obj) {
        const keys = key.split('.');
        let current = result;
        for (let i = 0; i < keys.length; i++) {
            const part = keys[i];
            if (i === keys.length - 1) {
                current[part] = obj[key];
            } else {
                current[part] = current[part] || {};
                current = current[part];
            }
        }
    }
    return result;
};

async function syncTranslations() {
    console.log(asciiArt);
    console.log('[INFO] Translation synchronization started.\n');

    if (DEEPL_API_KEY === 'YOUR_DEEPL_API_KEY' || !DEEPL_API_KEY) {
        console.error('[ERROR] DeepL API key is missing. Please check your .env file.');
        process.exit(1);
    }

    const baseFilePath = path.join(LOCALES_DIR, `${BASE_LANG}.json`);

    if (!fs.existsSync(baseFilePath)) {
        console.error(`[ERROR] Base language file not found at: ${baseFilePath}`);
        process.exit(1);
    }

    if (!fs.existsSync(LOCALES_DIR)) {
        fs.mkdirSync(LOCALES_DIR, { recursive: true });
    }

    const baseData = JSON.parse(fs.readFileSync(baseFilePath, 'utf8'));
    const flatBase = flatten(baseData);

    for (const lang of TARGET_LANGS) {
        const targetFilePath = path.join(LOCALES_DIR, `${lang}.json`);
        let targetData = {};

        if (fs.existsSync(targetFilePath)) {
            try {
                targetData = JSON.parse(fs.readFileSync(targetFilePath, 'utf8'));
            } catch (err) {
                console.error(`[ERROR] Failed to parse ${lang}.json. Skipping.`);
                continue;
            }
        }

        const flatTarget = flatten(targetData);
        const missingKeys = [];
        const textsToTranslate = [];
        let hasChanges = false;

        for (const [key, value] of Object.entries(flatBase)) {
            if (flatTarget[key] === undefined || flatTarget[key] === '') {
                if (typeof value === 'string' && value.trim() !== '') {
                    missingKeys.push(key);
                    textsToTranslate.push(value);
                } else {
                    flatTarget[key] = value;
                    hasChanges = true;
                }
            }
        }

        if (textsToTranslate.length === 0) {
            if (hasChanges) {
                const finalTargetData = unflatten(flatTarget);
                fs.writeFileSync(targetFilePath, JSON.stringify(finalTargetData, null, 2), 'utf8');
                console.log(`[INFO] [${lang.toUpperCase()}] synced (only empty/non-string values copied).`);
            } else {
                console.log(`[INFO] [${lang.toUpperCase()}] is already up to date.`);
            }
            continue;
        }

        console.log(`[WARN] [${lang.toUpperCase()}] is missing ${textsToTranslate.length} keys. Translating...`);

        try {
            const targetLangCode = lang.toUpperCase();
            const results = await translator.translateText(textsToTranslate, 'EN', targetLangCode);
            const translatedArray = Array.isArray(results) ? results : [results];

            translatedArray.forEach((res, index) => {
                const key = missingKeys[index];
                flatTarget[key] = res.text;
            });

            const finalTargetData = unflatten(flatTarget);
            fs.writeFileSync(targetFilePath, JSON.stringify(finalTargetData, null, 2), 'utf8');

            console.log(`[SUCCESS] [${lang.toUpperCase()}] translations have been saved successfully.`);

        } catch (error) {
            console.error(`[ERROR] Failed to translate [${lang.toUpperCase()}]:`, error.message);
        }
    }

    console.log('\n[INFO] All files have been synchronized successfully.');
}

syncTranslations();