import { parseBody, hasBodyContent, inlineImageIds } from "./rich-text";
export type EnglishTranslation = {
  title?: string;
  intro?: string;
  summary?: string;
  body?: string;
  bodyFormat?: "text" | "html";
  seoDescription?: string;
  imageAlt?: string;
  residence?: string;
  venue?: string;
  country?: string;
};
export type Translatable = { translations?: { en?: EnglishTranslation } };
export function parseTranslations(
  value: unknown,
): Translatable["translations"] {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Traducciones inválidas.");
  const translations = value as Record<string, unknown>;
  if (Object.keys(translations).some((key) => key !== "en"))
    throw new Error("Idioma no admitido.");
  if (translations.en === undefined) return {};
  if (
    !translations.en ||
    typeof translations.en !== "object" ||
    Array.isArray(translations.en)
  )
    throw new Error("Traducción inglesa inválida.");
  const data = translations.en as Record<string, unknown>;
  const result: EnglishTranslation = {};
  for (const [key, max] of Object.entries({
    title: 160,
    intro: 1000,
    summary: 1000,
    seoDescription: 320,
    imageAlt: 300,
    residence: 300,
    venue: 300,
    country: 100,
  })) {
    if (data[key] === undefined) continue;
    if (typeof data[key] !== "string" || data[key].length > max)
      throw new Error(`Traducción ${key} inválida (máximo ${max}).`);
    Object.assign(result, { [key]: data[key].trim() });
  }
  if (data.body !== undefined)
    Object.assign(result, parseBody(data.body, data.bodyFormat));
  return { en: result };
}
export function translatedImageIds(content: Translatable): string[] {
  const en = content.translations?.en;
  return en?.body ? inlineImageIds(en.body, en.bodyFormat) : [];
}
export function localizeContent<
  T extends Translatable & { body: string; bodyFormat?: "text" | "html" },
>(content: T, locale: string): T {
  const en = locale === "en" ? content.translations?.en : undefined;
  if (!en) return content;
  const result = { ...content };
  for (const key of [
    "title",
    "intro",
    "summary",
    "seoDescription",
    "imageAlt",
    "residence",
    "venue",
    "country",
  ] as const) {
    if (en[key]?.trim() && key in content)
      Object.assign(result, { [key]: en[key] });
  }
  if (en.body && hasBodyContent(en.body, en.bodyFormat)) {
    result.body = en.body;
    result.bodyFormat = en.bodyFormat;
  }
  return result;
}
