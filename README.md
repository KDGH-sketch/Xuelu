# Xuélù 学路: Chinese learning platform

- **Learner app** (`/`): learning paths, lessons with dialogues, 250 sentence patterns with a sentence generator, grammar, vocabulary, and a dictionary of 11,500 words.
  - Pinyin and audio on every word.
  - Practice in 10 activity types, plus quizzes, spaced review, pronunciation and handwriting practice.
  - Saved items, notes, progress by skill, and offline downloads.
  - Interface in English, Lao and Chinese.
- **Admin Backend** (`/admin/`): learners, plans and manual access (assign, extend, suspend, cancel, temporary, free), and roles (Super / Content / Support).
  - A content editor for every content type in three languages, with draft/published/archived status, version history and restore.
  - A quiz builder, learning paths and content releases.
  - One-click publishing to learners.
- **Backend:** Firebase Authentication + Cloud Firestore on the free Spark plan, with access enforced by `firestore.rules`.
- **Offline:** installable PWA (service worker), content cached on the device, and progress queued offline and synced later.

Start here: **[docs/SETUP.md](docs/SETUP.md)**. For how it's built, see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

Without a Firebase config the site runs in **demo mode**, with sample accounts stored in your browser.

Credits: HSK vocabulary with CC-CEDICT definitions (CC BY-SA 4.0) · character data and strokes from Make Me a Hanzi (Arphic PL / LGPL) · Hanzi Writer (MIT) · Firebase JS SDK (Apache 2.0).
