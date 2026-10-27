# Security notes

Ionized Study is a static single-page site (GitHub Pages) that syncs through Firebase Realtime Database over REST. There is no server of our own, no accounts, no passwords and no API keys.

## How access works

Each person's data lives under `/codes/<code>`, where the code is 8 random characters from a 31-letter alphabet (about 8.5 × 10¹¹ possibilities). Knowing the code is what grants access, the same way a long share link does.

- Listing `/codes` or the root is denied, so codes cannot be enumerated.
- Writes outside `/codes/<valid code>` are denied.
- `security/database.rules.json` adds structure and size checks: only the data areas the site uses (`q`, `pr`, `mock`, `hist`, `set`, `pdf` (including highlights and notes in `pdf/marks`), `nb`, `music`, `fonts`, `created`, `updated`), chunks under 600 KB, notebook pages under 9 MB, well-formed records. Paste it into Firebase console → Realtime Database → Rules → Publish.

Music and textbook PDFs are stored only under the owner's code, never in this public repository.

## Protections in the page

- **Content Security Policy** (meta tag): scripts, styles and fonts only from this site, cdnjs, jsDelivr and Google Fonts; network requests only to Firebase; no plugins, frames or `<base>` changes. `'unsafe-inline'` is needed by the single-file page and `'unsafe-eval'` by the equation solver (nerdamer compiles functions).
- **Subresource Integrity**: every CDN script and stylesheet carries a SHA-384 fingerprint, so a tampered copy is refused. (Google Fonts CSS changes per browser and cannot be pinned.)
- **Escaping**: everything typed by a user or synced from the database is HTML-escaped before display; synced ids, keys and colours are validated (`safeKey`, `safeId`, `safeColor` in `engine_utils.js`).
- **PDF.js**: `isEvalSupported: false` (the fix for CVE-2024-4367, crafted fonts running code).
- **Referrer policy**: `strict-origin-when-cross-origin`.

## Limits of a static site

- GitHub Pages cannot send custom HTTP headers, so `X-Frame-Options`, `Permissions-Policy` and HSTS settings beyond github.io's own cannot be added; the CSP is delivered as a meta tag.
- Firebase Realtime Database rules cannot rate-limit requests. Firebase applies its own abuse limits, and the free Spark plan stops at its quota instead of billing.
- Real user accounts (email or Google sign-in through Firebase Auth) would replace codes with logins; not done, to keep sign-in-free syncing.

## Reporting

Open an issue on this repository (without posting your sync code).
