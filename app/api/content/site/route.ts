import { localizeContent } from "lib/content/translations";
import type { AboutContent } from "lib/content/types";
import { NextResponse } from "next/server";
import { editorialDb, editorialConfigured } from "lib/content/firebase-admin";
import { getPublishedAbout } from "lib/content/repository";
import type {
  ContentEntry,
  ArtistContent,
  EventContent,
} from "lib/content/entries";
import { editorialResponse } from "lib/content/http";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    if (!editorialConfigured())
      return NextResponse.json(
        { error: "Content service is not configured" },
        { status: 503 },
      );
    const locale = new URL(request.url).searchParams.get("locale") || "es";
    if (!["es", "en"].includes(locale))
      return NextResponse.json(
        { error: "Unsupported locale" },
        { status: 400 },
      );
    const origin = process.env.DASHBOARD_ORIGIN || new URL(request.url).origin;
    const db = editorialDb();
    const [originalAbout, artists, events, contact] = await Promise.all([
      getPublishedAbout(),
      db.collection("published_artists").get(),
      db.collection("published_events").get(),
      db.collection("content_pages").doc("contact").get(),
    ]);
    const about = originalAbout ? localizeContent(originalAbout, locale) : null;
    const originalContact = contact.data()?.published as AboutContent | null;
    const localizedContact = originalContact
      ? localizeContent(originalContact, locale)
      : null;
    const image = (photo: { id: string; alt: string }) => ({
      ...photo,
      url: `${origin}/api/media/${photo.id}`,
    });
    return NextResponse.json(
      {
        schemaVersion: 1,
        content: {
          revision: 0,
          contact: localizedContact
            ? {
                title: localizedContact.title,
                body: localizedContact.body,
                bodyFormat: localizedContact.bodyFormat,
              }
            : null,
          about: about
            ? {
                title: about.title,
                paragraphs:
                  about.bodyFormat === "html"
                    ? [about.intro].filter(Boolean)
                    : [about.intro, ...about.body.split(/\n\s*\n/)].filter(
                        Boolean,
                      ),
                body: about.bodyFormat === "html" ? about.body : "",
                bodyFormat: about.bodyFormat,
                photo: about.imageId
                  ? image({ id: about.imageId, alt: about.imageAlt })
                  : null,
              }
            : null,
          artists: artists.docs
            .map((doc) =>
              localizeContent(doc.data().content as ArtistContent, locale),
            )
            .sort(
              (a, b) =>
                a.rosterOrder - b.rosterOrder || a.slug.localeCompare(b.slug),
            )
            .map((a) => ({
              slug: a.slug,
              name: a.title,
              live: a.live,
              bio: a.body,
              bioFormat: a.bodyFormat,
              residence: a.residence,
              photos: [a.cover, ...a.gallery]
                .filter((p): p is NonNullable<typeof p> => !!p)
                .filter(
                  (p, i, all) => all.findIndex((v) => v.id === p.id) === i,
                )
                .map(image),
              primaryPhotoId: a.cover?.id || "",
              links: a.links,
              published: true,
            })),
          events: events.docs
            .map((doc) =>
              localizeContent(doc.data().content as EventContent, locale),
            )
            .map((e) => ({
              slug: e.slug,
              title: e.title,
              startsAt: e.startsAt,
              endsAt: e.endsAt,
              timeZone: e.timeZone,
              venue: e.venue,
              city: e.city,
              body: e.body,
              bodyFormat: e.bodyFormat,
              photo: e.cover ? image(e.cover) : null,
              lineup: e.lineup,
              ticketUrl: e.ticketUrl,
              published: true,
            })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return editorialResponse(error);
  }
}
