'use strict';

const fs = require('fs');
const path = require('path');
const { plan, setAt, deleteAt, hash, compileIgnore } = require('./sync');
const { detectTargets, formalityFor } = require('./config');
const { toTargetCode, toSourceCode } = require('./translator');

const short = (s, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s).replace(/\n/g, '\\n');

function readJson(file) {
    if (!fs.existsSync(file)) return { raw: null, data: {} };
    const raw = fs.readFileSync(file, 'utf8');
    return { raw, data: raw.trim() === '' ? {} : JSON.parse(raw) };
}

async function run(config, flags, { getTranslate, log }) {
    const basePath = path.join(config.dir, `${config.base}.json`);
    if (!fs.existsSync(basePath)) {
        log.error(`Base language file not found: ${basePath}`);
        return 1;
    }

    let base;
    try {
        base = readJson(basePath).data;
    } catch (err) {
        log.error(`Could not parse ${basePath}: ${err.message}`);
        return 1;
    }

    const targets = config.targets || detectTargets(config.dir, config.base);
    if (targets.length === 0) {
        log.error(`No target languages. Add "targets" to the config, pass --targets tr,de, or create locales/<lang>.json files.`);
        return 1;
    }

    let lockFile = { version: 1, languages: {} };
    try {
        if (fs.existsSync(config.lockPath)) lockFile = JSON.parse(fs.readFileSync(config.lockPath, 'utf8'));
    } catch {
        log.warn(`Lock file is unreadable, starting a new one: ${config.lockPath}`);
    }
    const newLock = { version: 1, languages: { ...lockFile.languages } };

    const ignore = compileIgnore(config.ignoreKeys);
    let failed = 0;
    let outdated = 0;
    let totalChars = 0;

    for (const lang of targets) {
        const tag = `[${lang}]`;
        const targetPath = path.join(config.dir, `${lang}.json`);

        let existing;
        try {
            existing = readJson(targetPath);
        } catch (err) {
            log.error(`${tag} Could not parse ${lang}.json, skipping: ${err.message}`);
            failed++;
            continue;
        }

        const p = plan(base, existing.data, {
            lock: (lockFile.languages || {})[lang] || {},
            force: flags.force,
            prune: config.prune,
            ignore,
        });

        const missing = p.jobs.filter((j) => j.reason === 'missing').length;
        const changed = p.jobs.length - missing;
        const chars = p.jobs.reduce((n, j) => n + j.source.length, 0);
        totalChars += chars;

        if (p.orphans.length) {
            const preview = flags.check || flags.dryRun;
            const verb = !config.prune ? 'Found' : preview ? 'Would remove' : 'Removing';
            const hint = config.prune ? '' : ' (use --prune to remove)';
            log.warn(`${tag} ${verb} ${p.orphans.length} key(s) not in ${config.base}.json${hint}: ${p.orphans.slice(0, 5).join(', ')}${p.orphans.length > 5 ? ', …' : ''}`);
        }

        if (flags.check || flags.dryRun) {
            if (p.jobs.length === 0 && p.copied === 0) {
                log.info(`${tag} Up to date.`);
                continue;
            }
            outdated++;
            const parts = [];
            if (missing) parts.push(`${missing} missing`);
            if (changed) parts.push(`${changed} ${flags.force ? 'forced' : 'changed'}`);
            if (p.copied) parts.push(`${p.copied} to copy`);
            log.warn(`${tag} ${parts.join(', ')}${chars ? ` (${chars} characters)` : ''}`);
            if (flags.dryRun) {
                for (const j of p.jobs) log.plain(`    ${j.reason.padEnd(7)} ${j.key}  "${short(j.source)}"`);
            }
            continue;
        }

        const lockForLang = { ...p.lock };
        let keyErrors = 0;

        if (p.jobs.length) {
            log.info(`${tag} Translating ${p.jobs.length} string(s): ${missing} missing, ${changed} ${flags.force ? 'forced' : 'changed'}…`);
            let translate;
            try {
                translate = getTranslate();
            } catch (err) {
                log.error(err.message);
                return 1;
            }

            let results;
            try {
                results = await translate(p.jobs.map((j) => j.source), {
                    source: toSourceCode(config.base),
                    target: toTargetCode(lang, config.langMap),
                    formality: formalityFor(config, lang),
                    glossary: config.glossaries[lang],
                    context: config.context || undefined,
                });
            } catch (err) {
                log.error(`${tag} Translation failed: ${err.message}`);
                failed++;
                continue;
            }

            p.jobs.forEach((job, i) => {
                const r = results[i];
                if (r && r.text !== undefined) {
                    setAt(p.output, job.path, r.text);
                    lockForLang[job.key] = hash(job.source);
                } else {
                    keyErrors++;
                    log.warn(`${tag} Skipped ${job.key}: ${r ? r.error : 'no result'}`);
                    if (job.reason === 'missing') deleteAt(p.output, job.path);
                }
            });
        }

        newLock.languages[lang] = lockForLang;

        const serialized = JSON.stringify(p.output, null, config.indent) + '\n';
        if (serialized !== existing.raw) {
            fs.writeFileSync(targetPath, serialized, 'utf8');
            log.success(`${tag} Saved ${lang}.json${keyErrors ? ` (${keyErrors} key(s) skipped)` : ''}.`);
        } else {
            log.info(`${tag} Up to date.`);
        }
        if (keyErrors) failed++;
    }

    if (flags.check) {
        if (outdated) {
            log.error(`${outdated} language(s) need syncing. Run i18n-auto to fix.`);
            return 1;
        }
        log.success('All translations are in sync.');
        return 0;
    }

    if (flags.dryRun) {
        log.info(outdated ? `Dry run: ${totalChars} characters would be sent to DeepL. Nothing was written.` : 'Dry run: nothing to do.');
        return 0;
    }

    const lockSerialized = JSON.stringify(newLock, null, 2) + '\n';
    const oldLockRaw = fs.existsSync(config.lockPath) ? fs.readFileSync(config.lockPath, 'utf8') : null;
    if (lockSerialized !== oldLockRaw) fs.writeFileSync(config.lockPath, lockSerialized, 'utf8');

    if (failed) log.error(`${failed} language(s) had errors.`);
    else log.success('All files are in sync.');
    return failed ? 1 : 0;
}

module.exports = { run };
