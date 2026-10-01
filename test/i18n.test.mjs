// Every locale has every English key, no others, and the same placeholders and <code> spans.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../src/i18n/', import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const en = read('en.json');
const locales = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json');
const placeholders = (s) => (s.match(/\{\w+\}/g) ?? []).sort();
const codes = (s) => (s.match(/<code>.*?<\/code>/g) ?? []).sort();

test('there are nine translations', () => {
  assert.deepEqual(locales.sort(), ['de.json', 'es.json', 'fr.json', 'ja.json', 'ko.json', 'pt-BR.json', 'ru.json', 'uk.json', 'zh-CN.json']);
});

for (const file of locales) {
  test(file, () => {
    const dict = read(file);
    const missing = Object.keys(en).filter((k) => typeof dict[k] !== 'string' || !dict[k].trim());
    const extra = Object.keys(dict).filter((k) => !(k in en));
    assert.deepEqual(missing, [], `${file} is missing keys`);
    assert.deepEqual(extra, [], `${file} has keys English does not`);
    for (const k of Object.keys(en)) {
      assert.deepEqual(placeholders(dict[k]), placeholders(en[k]), `${file} ${k}: placeholders`);
      assert.deepEqual(codes(dict[k]), codes(en[k]), `${file} ${k}: <code> spans`);
    }
  });
}
