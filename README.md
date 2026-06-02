# i18n-auto

Automatically synchronize and translate your i18n JSON files using the power of DeepL API. Keep all your localization files in sync with a single command.

![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Automated Translation:** Uses DeepL API to translate missing keys instantly.
- **Smart Sync:** Only translates new or empty keys, preserving existing translations.
- **Nested JSON Support:** Handles complex nested translation structures.
- **ASCII Art:** Cool terminal output to keep you motivated.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- A DeepL API Key ([Get one here](https://www.deepl.com/pro-api))

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/whoisch4t/i18n-auto.git
   cd i18n-auto
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Rename `.env.example` to `.env`.
   - Add your DeepL API Key:
     ```env
     DEEPL_API_KEY=your_api_key_here
     ```

## Usage

Place your base language file (e.g., `en.json`) in the `locales/` directory. Then run:

```bash
npm start
```

The script will:
1. Scan your `locales/` directory.
2. Identify missing keys in target languages compared to the base language.
3. Translate missing values using DeepL.
4. Update the target JSON files while keeping the structure intact.

## Configuration

You can customize the following constants in `index.js`:

- `BASE_LANG`: The source language (default: `en`).
- `TARGET_LANGS`: Array of languages you want to translate into (e.g., `['tr', 'ru', 'fr']`).
- `LOCALES_DIR`: The path to your translation files.

## License

Distributed under the MIT License. See `LICENSE` for more information.

---
Created with ❤️ by [whoisch4t]

