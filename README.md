# 22 Recordings Dashboard

Independent Next.js application, a sibling of `../web`. The shell, tables,
forms, Quill editor and media library derive from the Error404 dashboard.
Its content model and Firebase configuration belong exclusively to 22 Recordings.

## Development

Use Node 24.12 or newer and npm. With nvm, run `nvm install` and `nvm use` first:

```sh
npm ci
npm run dev
```

Open http://localhost:3002/login. The public website remains on port 3000.
Local `.env.local` is configured for project `recordings-9108f`, with
`matiasespina1991@gmail.com` allowed to enter. Change `DASHBOARD_ADMIN_EMAILS` to
manage access; Google accounts must have verified email. Google provider is
enabled in Firebase. No authentication bypass exists.

## Modules

- `/events`: event table, editor, dates in event timezone, flyer and gallery.
- `/artists`: Agencia table and artist editor: name, biography, residence, Live
  designation, roster order, principal image, gallery and platform links.
- `/about`: introduction, rich text, image, alt and SEO fields.
- `/media`: upload, select, rename and delete images, with usage protection.

Every editor has separate Save draft, Preview, Publish and Unpublish actions.
Stale revisions return 409. Saving a draft leaves the public snapshot unchanged.
Only published snapshots and referenced public media are exposed without login.

## Firebase and existing content

Firebase Admin is exclusive to this application. Browser Firebase config uses
`NEXT_PUBLIC_FIREBASE_*`; server credentials never do. Local credentials are in
`.local/credentials/firebase-admin.json`, ignored by Git. Production uses a
service account configured with `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
`FIREBASE_PRIVATE_KEY` and `FIREBASE_STORAGE_BUCKET`, or workload identity.

Existing About, nine artists and two mock events were converted to draft and
published snapshots. The shared image was imported into the media library as
lossless WebP plus a thumbnail, with media references. Source backup is retained
in `.local/migration/`; the old Storage image is retained for rollback.

`npm run content:migrate --` is a dry run against the old source schema. Add `--apply`
only for its initial conversion; a completed conversion is detected and skipped.
Do not run the old web migration against the converted records.

## Public API

- `/api/content/site`: versioned normalized published content consumed by 22 web.
- `/api/content/about`: published About.
- `/api/content/events` and `/api/content/artists`: paginated public feeds.
- `/api/content/{kind}/{slug}`: published detail; authenticated writes.
- `/api/media/{id}`: published image, or private image for a signed-in editor.

The website sets `DASHBOARD_URL=http://localhost:3002` locally and
`DASHBOARD_URL=https://dashboard.22recordings.com` in production. It has no Admin
SDK or database writes. Server-to-server reads need no browser CORS grant.

## Independent deployment

Deploy this directory as its own Next.js project, independently from `../web`.
Use its own Git repository, or select `dashboard` as the root if both are in a
parent repository. Keep the web project's deployment root unchanged.

Configure the variables in `.env.example`, with:

```dotenv
DASHBOARD_ORIGIN=https://dashboard.22recordings.com
NEXT_PUBLIC_SITE_URL=https://veintidosrecordings.com
```

Add `dashboard.22recordings.com` to the dashboard deployment and configure the DNS
record supplied by its host. This domain has been added to Firebase Auth's
authorized domains. Set the matching `DASHBOARD_URL` on the web and redeploy it.
Do not set `NODE_ENV=development` in production.

Keep Firestore/Storage rules closed to browser access. Their rule files are
included, but deploying the application alone does not deploy rules. Never commit
service-account JSON or place it in `public/`. Replace the previously shared
service-account key before publishing credentials to a deployment environment.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Tests cover publication, concurrent revisions, rich text sanitation, gallery
references, artist links, event dates and table search/pagination. Browser Google
login still requires an interactive sign-in with an allowed account.
