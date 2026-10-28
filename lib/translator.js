'use strict';

const { protect, restore } = require('./placeholders');

const DEFAULT_TARGET_CODES = {
    en: 'EN-US',
    pt: 'PT-BR',
    zh: 'ZH-HANS',
    'zh-cn': 'ZH-HANS',
    'zh-hans': 'ZH-HANS',
    'zh-tw': 'ZH-HANT',
    'zh-hant': 'ZH-HANT',
};

const normalize = (lang) => lang.replace(/_/g, '-').toLowerCase();

function toTargetCode(lang, langMap = {}) {
    return langMap[lang] || DEFAULT_TARGET_CODES[normalize(lang)] || normalize(lang).toUpperCase();
}

function toSourceCode(lang) {
    return normalize(lang).split('-')[0].toUpperCase();
}

const BATCH_SIZE = 50;

function createTranslator(deeplTranslator) {
    return async function translate(texts, { source, target, formality, glossary, context }) {
        const results = [];
        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, i + BATCH_SIZE).map(protect);
            const options = { tagHandling: 'xml', ignoreTags: ['x'] };
            if (formality) options.formality = formality;
            if (glossary) options.glossary = glossary;
            if (context) options.context = context;

            const res = await deeplTranslator.translateText(batch.map((b) => b.text), source, target, options);
            const list = Array.isArray(res) ? res : [res];
            list.forEach((r, j) => {
                try {
                    results.push({ text: restore(r.text, batch[j].tokens) });
                } catch (err) {
                    results.push({ error: err.message });
                }
            });
        }
        return results;
    };
}

module.exports = { createTranslator, toTargetCode, toSourceCode, BATCH_SIZE };
