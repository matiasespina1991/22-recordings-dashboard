import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTranslations,
  localizeContent,
} from "../lib/content/translations.ts";
import { parseAbout } from "../lib/content/validation.ts";
import { emptyAbout } from "../lib/content/types.ts";
import { nextAbout, aboutImageIds } from "../lib/content/publication.ts";
import { validateEntry, emptyEntry } from "../lib/content/entries.ts";
import { imageIds } from "../lib/content/entry-publication.ts";
const base = {
  ...emptyAbout().draft,
  title: "Nosotros",
  body: "Texto español",
  bodyFormat: "text" as const,
};
test("English fields fall back individually and body format follows the selected body", () => {
  const content = {
    ...base,
    translations: {
      en: { title: "About", body: "<p><br></p>", bodyFormat: "html" as const },
    },
  };
  assert.equal(localizeContent(content, "en").title, "About");
  assert.equal(localizeContent(content, "en").body, "Texto español");
  assert.equal(localizeContent(content, "en").bodyFormat, "text");
  assert.equal(localizeContent(content, "es").title, "Nosotros");
  assert.equal(content.title, "Nosotros");
});
test("translation parsing rejects unsupported locales and sanitizes HTML", () => {
  assert.throws(() => parseTranslations({ fr: { body: "Bonjour" } }));
  assert.throws(() => parseTranslations({ en: { title: "x".repeat(161) } }));
  const en = parseTranslations({
    en: { body: "<p>Hello</p><script>alert(1)</script>", bodyFormat: "html" },
  })?.en;
  assert.equal(en?.body, "<p>Hello</p>");
});
test("Spanish records remain compatible and publishing keeps English drafts private", () => {
  assert.equal(parseAbout(base, true).translations, undefined);
  const translated = parseAbout(
    { ...base, translations: { en: { body: "English" } } },
    true,
  );
  const published = nextAbout(
    emptyAbout(),
    translated,
    0,
    "publish",
    "u",
    "2026-01-01",
  );
  const saved = nextAbout(
    published,
    { ...translated, translations: { en: { body: "Draft" } } },
    1,
    "save",
    "u",
    "2026-01-02",
  );
  assert.equal(saved.published?.translations?.en?.body, "English");
  assert.equal(saved.draft.translations?.en?.body, "Draft");
});
test("entry validation preserves translations and protects images referenced only in English", () => {
  const id = "image-00000000-0000-0000-0000-000000000000";
  const translations = {
    en: {
      body: `<p>Hello</p><img src="/api/media/${id}" alt="Photo">`,
      bodyFormat: "html" as const,
    },
  };
  const entry = validateEntry(
    { ...emptyEntry("artists", "test").draft, translations },
    "artists",
    "test",
    false,
  );
  assert.equal(entry.translations?.en?.bodyFormat, "html");
  assert.ok(imageIds(entry).includes(id));
  assert.ok(aboutImageIds({ ...base, translations }).includes(id));
});
