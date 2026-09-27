# Xuélù architecture

```
Learner app (index.html) ─┐                          ┌─ Firebase Authentication (accounts)
                          ├─ js/api (data layer) ────┤
Admin Backend (admin/) ───┘   Firebase or demo       └─ Cloud Firestore (data, rules, offline cache)
        │
        └─ Publish → bundles/{tier} ← learners download their plan's package
```

- **No build step.** Plain ES modules, with Firebase SDK v12 bundled in `vendor/`. This keeps the site working offline and easy to host on GitHub Pages.
- **Data layer:** `js/api/` exposes one interface (`auth`, `db`, `storage`), with two implementations:
  - `firebase.js`
  - `local.js`, the demo mode in IndexedDB.

  Swapping the backend never touches the apps.
- **Content is data, not HTML.** Every lesson, pattern, word, quiz and path is a Firestore document. It's edited in the Admin Backend and published without redeploying the site.

## Terminology

| Term | Meaning | Where |
|---|---|---|
| Admin | Platform owner or staff | `admins/{uid}` with role `super` / `content` / `support` |
| Learner | A client who studies | `users/{uid}` with `role: "learner"` |
| Account | Login identity | Firebase Auth + `users/{uid}` |
| Plan | What a tier unlocks | `plans/{planId}` → `tier` |
| Access | The learner's current entitlement | `access/{uid}` (effective) + `subscriptions/{id}` (history) |
| Content | Lessons, patterns, grammar… | Content collections below |

## Firestore collections

| Collection | Purpose | Who can read / write |
|---|---|---|
| `users/{uid}` | Profile: name, email, status, level, prefs (UI and explanation language) | Self (prefs only) · support admins |
| `admins/{uid}` | Role | Admins · Super Admin writes |
| `adminNotes/{uid}` | Private notes about a learner | Support admins |
| `plans/{id}` | Name (en/lo/zh), tier, duration, price, features | Anyone reads · Super Admin writes |
| `access/{uid}` | planId, tier, status, start, expiresAt, source | Self reads · support admins write |
| `subscriptions/{id}` | Every assign / extend / suspend / cancel, with who and when | Admins |
| `patterns`, `lessons`, `grammar`, `vocabulary`, `dialogues`, `quizzes`, `audio`, `paths`, `releases`, `lexicon` | Content. Each has `status`, `access`, `level`, `order`, `version`, `createdAt`, `updatedAt`, `updatedBy` | Admins read · content admins write |
| `{content}/{id}/versions/{v}` | Previous versions (snapshot, savedAt, savedBy) | Admins |
| `bundles/meta`, `bundles/t{tier}_p{n}` | Published content per tier, split under Firestore's 1 MB doc limit | Readable only by accounts with that tier or higher |
| `progress/{uid}` | Skills (right/total per skill), lessons, patterns, study days, last position | Self · admins read |
| `progress/{uid}/events/{id}` | Meaningful events: lesson done, quiz score, review, writing, speaking… | Self creates · admins read |
| `reviews/{uid}/items/{id}` | Spaced-repetition cards (SM-2 style) | Self |
| `bookmarks/{uid}/items/{id}` | Saved words, sentences, lessons, patterns, grammar | Self |
| `notes/{uid}/items/{id}` | Learner notes | Self |
| `activity/{id}` | Feed for the admin dashboard | Self creates · admins read |
| `settings/app`, `settings/bundle`, `settings/bootstrap` | App settings, publish state, one-time owner setup | See rules |

### Three languages without duplicating content

Translatable text is stored as language maps inside one document, for example `title: { en, lo, zh }` or `tr: { en: {meaning, how}, lo: {…}, zh: {…} }`. Each learner has two settings:

- **interface language** (`prefs.uiLang`)
- **explanation language** (`prefs.explainLang`)

Content shows the explanation language when a translation exists, and falls back to English otherwise. To add a language later, add a column in `js/shared/i18n.js` and a key in the editor's language list.

## Access control

Tiers:

| Tier | Level |
|---|---|
| 0 | Public |
| 1 | Free (any active account) |
| 2 | Standard |
| 3 | Premium |
| 99 | Admin only |

Plans map to tiers, and an admin can create more.

`myTier()` in `firestore.rules` is computed from the learner's `users` status and `access` document, including expiry, on the server side. Learners can only read `bundles/t{N}` where N ≤ their tier. Raw content collections are admin-only. Hiding a button is never the protection.

The `catalog` inside the tier-0 bundle lists titles of everything published, so the app can show "🔒 Premium" teasers without exposing the content.

## Publishing

`buildBundles()` in `js/shared/content.js`:

1. Reads all content.
2. Keeps `status == "published"`.
3. For every tier builds a JSON package with the items that tier may see.
4. Writes the package parts, then `bundles/meta` with a new version number.

The learner app reads `meta` (1 read). It downloads parts only when the version changed, and caches the package in IndexedDB.

## Offline

- **App shell and data:** `sw.js` caches pages, scripts, the dictionary and fonts. Stroke data and audio are cached on use, or from **Offline downloads**.
- **Content:** the learner's bundle is kept in IndexedDB.
- **Progress:** Firestore's persistent cache queues writes made offline and syncs them when the connection returns. Progress uses per-field updates and `increment()`, so two devices never overwrite each other.
- **Admin:** the Admin Backend needs a connection.

## Sentence generator

Patterns carry templates such as `{P} 一边 {VA} 一边 {VB} 。` / `{P} {VA@} while {VB.g}.`

- **Shared word lists** (P = people, VO = activities, PL = places, NA = things with fitting adjectives…) live in `lexicon`, and admins can edit them.
- **Per-template lists** go in the template's Slots field.
- **The engine** (`js/shared/engine.js`) builds the sentence, the pinyin (with 不/一 tone changes) and the English. It conjugates English verbs (`{V@}`, `[[like]]`) and runs entirely on the device.

## Quiz engine

`js/shared/quiz.js` renders every question type from data:

- mc
- fill
- order
- match
- type
- listen_select
- listen_type
- tone
- speak (browser speech recognition)
- write_char (Hanzi Writer)
- flashcard

The admin Quiz Builder writes the same format, and auto-generated drills use it too.

## Adding online payments later

Access is already separate from payment, so payments plug in without redesign:

1. Upgrade to the Blaze plan and add a Cloud Function (for example `functions/paymentWebhook`).
2. Your payment provider (Stripe, OnePay, BCEL…) calls the webhook after a successful payment.
3. The function verifies the signature, then does what the admin panel does today:
   - writes `subscriptions/{id}` with `source: "payment"` and the payment reference;
   - updates `access/{uid}` with `{ planId, tier, status: "active", expiresAt }`.
4. A scheduled function can mark expired access and send reminders.

Nothing else changes: rules, bundles and the learner app already read `access/{uid}`.

For stricter admin actions later, a callable function using the Admin SDK can create accounts, set custom claims and delete Auth users. On the Spark plan, these run from the admin browser through a secondary Firebase app instance.
