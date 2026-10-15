import { SLUG, IMAGE_ID } from "./patterns";
import { parseBody, hasBodyContent } from "./rich-text";
import type { BodyFormat } from "./rich-text-format";
// Version 1 public contract, mirrored in the independent dashboard project.
export type ContentKind = "events" | "artists";
export type ContentImage = { id: string; alt: string };
type CommonContent = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  bodyFormat?: BodyFormat;
  cover: ContentImage | null;
  gallery: ContentImage[];
  seoDescription: string;
};
export type EventContent = CommonContent & {
  kind: "events";
  startsAt: string;
  endsAt: string;
  timeZone: string;
  venue: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  lineup: string[];
  eventType: string;
  ticketStatus: "available" | "free" | "sold-out" | "cancelled";
  ticketUrl: string;
  price: string;
  websiteUrl: string;
  facebookUrl: string;
  contactEmail: string;
};
export type ArtistContent = CommonContent & {
  kind: "artists";
  residence: string;
  live: boolean;
  rosterOrder: number;
  links: {
    platform:
      | "soundcloud"
      | "youtube"
      | "discogs"
      | "instagram"
      | "resident-advisor";
    url: string;
    label: string;
  }[];
};
export type ContentEntry = EventContent | ArtistContent;
export type ContentPage = {
  items: ContentEntry[];
  cursor: string | null;
  source: "firebase" | "mock";
};
export type EntryDocument = {
  schemaVersion: 1;
  revision: number;
  draft: ContentEntry;
  published: ContentEntry | null;
  publishedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};
export { SLUG, IMAGE_ID } from "./patterns";
export function isContentKind(value: string): value is ContentKind {
  return value === "events" || value === "artists";
}
export function emptyEntry(kind: ContentKind, slug: string): EntryDocument {
  const common = {
    slug,
    title: "",
    summary: "",
    body: "",
    cover: null,
    gallery: [],
    seoDescription: "",
  };
  const draft: ContentEntry =
    kind === "events"
      ? {
          ...common,
          kind,
          startsAt: "",
          endsAt: "",
          timeZone: "Europe/Madrid",
          venue: "",
          address: "",
          city: "",
          region: "",
          postalCode: "",
          country: "",
          lineup: [],
          eventType: "Club night",
          ticketStatus: "available",
          ticketUrl: "",
          price: "",
          websiteUrl: "",
          facebookUrl: "",
          contactEmail: "",
        }
      : {
          ...common,
          kind,
          residence: "",
          live: false,
          rosterOrder: 0,
          links: [],
        };
  return {
    schemaVersion: 1,
    revision: 0,
    draft,
    published: null,
    publishedAt: null,
    updatedAt: null,
    updatedBy: null,
  };
}
export function validateEntry(
  value: unknown,
  kind: ContentKind,
  slug: string,
  publishing: boolean,
): ContentEntry {
  const fail = (message: string): never => {
    throw new Error(message);
  };
  if (!value || typeof value !== "object") return fail("Contenido inválido.");
  const data = value as Record<string, unknown>;
  if (
    !SLUG.test(slug) ||
    slug.length > 120 ||
    data.slug !== slug ||
    data.kind !== kind
  )
    return fail("URL o tipo inválido.");
  const text = (key: string, max = 300): string => {
    const value = data[key];
    if (typeof value !== "string" || value.length > max)
      return fail(`Revisá ${key} (máximo ${max} caracteres).`);
    return value.trim();
  };
  const image = (value: unknown): ContentImage => {
    if (!value || typeof value !== "object") return fail("Imagen inválida.");
    const item = value as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !IMAGE_ID.test(item.id) ||
      typeof item.alt !== "string" ||
      item.alt.length > 300
    )
      return fail("Imagen inválida.");
    if (publishing && !item.alt.trim())
      return fail("Agregá una descripción a cada imagen.");
    return { id: item.id, alt: item.alt.trim() };
  };
  if (!Array.isArray(data.gallery) || data.gallery.length > 12)
    return fail("Máximo 12 imágenes en la galería.");
  const common = {
    slug,
    title: text("title", 160),
    summary: text("summary", 1000),
    ...parseBody(data.body, data.bodyFormat),
    seoDescription: text("seoDescription", 320),
    cover: data.cover === null ? null : image(data.cover),
    gallery: data.gallery.map(image),
  };
  if (
    publishing &&
    (!common.title ||
      !common.summary ||
      !hasBodyContent(common.body, common.bodyFormat) ||
      !common.cover)
  )
    return fail(
      "Para publicar completá título, resumen, texto e imagen principal.",
    );
  const url = (key: string) => {
    const result = text(key, 2000);
    if (result) {
      try {
        const parsed = new URL(result);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password)
          return fail("Los enlaces deben usar HTTPS.");
      } catch {
        return fail("Enlace inválido.");
      }
    }
    return result;
  };
  const date = (key: string) => {
    const result = text(key, 50);
    if (
      result &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        result,
      ) ||
        !Number.isFinite(Date.parse(result)))
    )
      return fail("Fecha inválida: usá ISO con zona horaria.");
    if (result) {
      const day = result.slice(0, 10),
        clock = result.slice(11, 19);
      const local = new Date(`${day}T${clock}Z`);
      if (
        !Number.isFinite(local.getTime()) ||
        local.toISOString().slice(0, 19) !== `${day}T${clock}`
      )
        return fail("Fecha o hora inexistente.");
    }
    if (publishing && !result)
      return fail("Completá las fechas antes de publicar.");
    return result ? new Date(result).toISOString() : "";
  };
  if (kind === "artists") {
    if (
      typeof data.live !== "boolean" ||
      !Number.isSafeInteger(data.rosterOrder) ||
      (data.rosterOrder as number) < 0
    )
      return fail("Formato u orden de artista inválido.");
    if (!Array.isArray(data.links) || data.links.length > 30)
      return fail("Máximo 30 enlaces.");
    const domains: Record<string, string[]> = {
      soundcloud: ["soundcloud.com"],
      youtube: ["youtube.com", "youtu.be"],
      discogs: ["discogs.com"],
      instagram: ["instagram.com"],
      "resident-advisor": ["ra.co", "residentadvisor.net"],
    };
    const seen = new Set<string>();
    const links = data.links.map((item: unknown) => {
      if (!item || typeof item !== "object") return fail("Enlace inválido.");
      const link = item as Record<string, unknown>;
      if (
        typeof link.platform !== "string" ||
        !domains[link.platform] ||
        typeof link.url !== "string" ||
        typeof link.label !== "string" ||
        link.label.length > 200 ||
        link.url.length > 2000
      )
        return fail("Plataforma o enlace inválido.");
      let parsed: URL;
      try {
        parsed = new URL(link.url);
      } catch {
        return fail("Enlace inválido.");
      }
      if (
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password ||
        !domains[link.platform]!.some(
          (domain) =>
            parsed.hostname === domain ||
            parsed.hostname.endsWith(`.${domain}`),
        )
      )
        return fail("El enlace no corresponde a su plataforma o no usa HTTPS.");
      const normalized = parsed.href;
      if (seen.has(normalized)) return fail("Hay enlaces duplicados.");
      seen.add(normalized);
      return {
        platform: link.platform as ArtistContent["links"][number]["platform"],
        url: normalized,
        label: link.label.trim(),
      };
    });
    const entry: ArtistContent = {
      ...common,
      kind,
      residence: text("residence", 300),
      live: data.live,
      rosterOrder: data.rosterOrder as number,
      links,
    };
    if (publishing && !entry.residence)
      return fail("Completá el lugar de residencia.");
    return entry;
  }
  const startsAt = date("startsAt"),
    endsAt = date("endsAt"),
    timeZone = text("timeZone", 100);
  if (startsAt && endsAt && endsAt <= startsAt)
    return fail("La fecha final debe ser posterior al inicio.");
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    return fail("Zona horaria inválida.");
  }
  if (
    !Array.isArray(data.lineup) ||
    data.lineup.length > 50 ||
    !data.lineup.every((item) => typeof item === "string" && item.length <= 160)
  )
    return fail("Line-up inválido (máximo 50 artistas).");
  const status = data.ticketStatus;
  if (
    !["available", "free", "sold-out", "cancelled"].includes(status as string)
  )
    return fail("Estado de entradas inválido.");
  const entry: EventContent = {
    ...common,
    kind,
    startsAt,
    endsAt,
    timeZone,
    venue: text("venue"),
    address: text("address"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postalCode", 30),
    country: text("country", 100),
    lineup: data.lineup.map((item) => (item as string).trim()).filter(Boolean),
    eventType: text("eventType", 100),
    ticketStatus: status as EventContent["ticketStatus"],
    ticketUrl: url("ticketUrl"),
    websiteUrl: url("websiteUrl"),
    facebookUrl: url("facebookUrl"),
    price: text("price", 100),
    contactEmail: text("contactEmail", 200),
  };
  if (
    entry.contactEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.contactEmail)
  )
    return fail("Email inválido.");
  if (
    publishing &&
    (!entry.venue || !entry.city || !entry.country || !entry.lineup.length)
  )
    return fail("Completá sala, ciudad, país y line-up.");
  return entry;
}
