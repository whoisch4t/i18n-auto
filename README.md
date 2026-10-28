# i18n-auto

Automatically synchronize and translate your i18n JSON files using the DeepL API. Keep all your localization files in sync with a single command.

![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.3-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Translates only what's needed:** missing or empty keys, plus keys whose English text changed since the last run.
- **Safe placeholders:** `{{name}}`, `{count}`, `%s`, `%1$d`, `%(user)s`, `$t(key)` and inline HTML like `<b>` are never translated. If DeepL breaks one, that key is skipped instead of being saved wrong.
- **Clean diffs:** target files follow the key order of your base file.
- **CI friendly:** `--check` fails the build when translations are out of date. `--dry-run` shows the cost before you spend it.
- **Prune:** removes keys you deleted from the base file (`--prune`).
- **Nested JSON, arrays and keys with dots** (`"v1.0"`) are all supported.
- **DeepL extras:** formality, glossaries and context, set per language.

## Getting Started

You need Node.js 18.3+ and a DeepL API key ([get one here](https://www.deepl.com/pro-api)).

```bash
npm install --save-dev github:whoisch4t/i18n-auto
```

Add your key to a `.env` file in your project (or set it in the environment):

```env
DEEPL_API_KEY=your_api_key_here
```

Put your base file at `locales/en.json`, create an empty file for each language you want (`locales/tr.json`, `locales/de.json`, …) and run:

```bash
npx i18n-auto
```

## Usage

```
i18n-auto [options]

  -b, --base <lang>       Source language file name (default: en)
  -t, --targets <list>    Comma-separated target languages (default: every *.json in dir)
  -d, --dir <path>        Locales directory (default: ./locales)
  -c, --config <file>     Config file (default: ./i18n-auto.config.json)
      --dry-run           Show what would be translated, write nothing
      --check             Exit with code 1 if anything is missing or outdated (for CI)
      --prune             Remove keys that no longer exist in the base file
      --force             Retranslate every string
  -q, --quiet             No banner, only warnings and errors
```

`--check` and `--dry-run` don't call DeepL and don't need an API key.

### In CI

```yaml
- run: npx i18n-auto --check
```

## Configuration

Create `i18n-auto.config.json` in your project root. Every field is optional. CLI flags take precedence over the file.

```json
{
  "base": "en",
  "dir": "src/locales",
  "targets": ["tr", "de", "pt-BR", "zh"],
  "formality": { "de": "prefer_less", "tr": "prefer_more" },
  "glossaries": { "de": "your-deepl-glossary-id" },
  "context": "UI strings for a chat application",
  "ignoreKeys": ["brand.*", "legal.**"],
  "langMap": { "en": "EN-GB" },
  "indent": 2,
  "prune": false
}
```

| Field | Description |
| --- | --- |
| `base` | Source language. Its file is `<dir>/<base>.json`. |
| `dir` | Locales folder, relative to the config file. |
| `targets` | Languages to translate into. If left out, every `*.json` in `dir` is used. |
| `formality` | `"prefer_more"` / `"prefer_less"` for all languages, or one value per language. |
| `glossaries` | DeepL glossary ID per language. |
| `context` | Extra hint for DeepL. It is not translated and not billed. |
| `ignoreKeys` | Keys copied from the base file as they are. `*` matches one level, `**` matches any depth. |
| `langMap` | Overrides the DeepL code for a file name. Defaults: `en` → `EN-US`, `pt` → `PT-BR`, `zh` → `ZH-HANS`. |

### The lock file

`locales/.i18n-auto.lock.json` stores a short hash of each English string that has been translated. When you edit a string in `en.json`, the next run notices and translates it again. **Commit this file.**

Existing translations are never overwritten unless their source text changed, so you can safely fix a translation by hand.

## Development

```bash
npm install
npm test
npm run lint
```

## License

Distributed under the MIT License. See `LICENSE` for more information.

---
Created with ❤️ by whoisch4t
