# Setting up Xuélù (about 20 minutes)

Xuélù has two apps:

| App | Address | Who uses it |
|---|---|---|
| **Learner app** | `https://YOUR-SITE/` | Your clients (learners) |
| **Admin Backend** | `https://YOUR-SITE/admin/` | You and your administrators |

Until you connect Firebase, both apps run in **demo mode**. Everything works, but the data stays in that one browser. Demo sign-ins:

- Admin: `admin@demo.xuelu` / `demo1234`
- Learner, Premium plan: `learner@demo.xuelu` / `demo1234`
- Learner, Free plan: `free@demo.xuelu` / `demo1234`

---

## 1. Create the Firebase project (free Spark plan)

1. Go to **console.firebase.google.com** → **Create a project** → name it `xuelu` → **Create**.
2. **Build → Authentication → Get started → Email/Password → Enable → Save.**
3. **Build → Firestore Database → Create database** → location `asia-southeast1` (Singapore) → **Start in production mode**.
4. **Authentication → Settings → Authorized domains → Add domain**: your website domain, for example `kdgh-sketch.github.io`.
5. **Project settings (⚙️) → Your apps → `</>` Web → Register app.** Copy the `firebaseConfig` block.

## 2. Connect the website to Firebase

Open `js/config.js` and fill in the config and your owner email:

```js
export const firebaseConfig = {
  apiKey: "…", authDomain: "…", projectId: "…",
  storageBucket: "…", messagingSenderId: "…", appId: "…"
};
export const OWNER_EMAIL = "you@example.com";
```

The config is not a secret. The security rules below protect your data.

## 3. Install the security rules

1. Open `firestore.rules` and replace `OWNER_EMAIL_HERE` with the same owner email.
2. In the Firebase console: **Firestore Database → Rules**. Delete everything, paste the whole contents of `firestore.rules`, then click **Publish**.

The rules make sure that:

- Learners can only read content for their own plan. A Standard account can't open Premium content even by editing code or URLs.
- Only admins can read raw content, learner lists, notes and access records.
- Only the Super Admin can manage administrators, plans and settings.
- Disabled accounts can't save progress.

## 4. Upload the website

Upload **all files and folders** to your GitHub repository, keeping the folders as they are: `index.html`, `admin/`, `css/`, `js/`, `data/`, `vendor/`, `sw.js`, `manifest.webmanifest`, `icon.svg` and `.nojekyll`. Then turn on **Settings → Pages → Branch: main / root**.

## 5. Become Super Admin and load the starter content

1. In Firebase: **Authentication → Users → Add user**. Enter your owner email and a password.
2. Open `https://YOUR-SITE/admin/` and sign in.
3. Click **Make me Super Admin**. This works once, and only for the owner email.
4. Go to **Settings → Import starter content**. This adds:
   - 250 patterns
   - 56 lessons
   - 516 words with Lao
   - 6 grammar guides
   - 4 quizzes
   - 9 learning paths
   - 3 plans

   It then publishes them to learners.

## 6. Add your first learner

**Learners → New learner** → name, email, level, plan and expiry date → **Create**. Give the learner their email and the temporary password shown, or tick *email a link* so they set their own password.

---

## Everyday tasks

| I want to… | Where |
|---|---|
| Give someone access after they pay | Learners → learner → **Assign plan** or **+1 year** |
| Pause or end access | Learner → **Suspend** / **Cancel access** |
| Block an account | Learner → **Disable** |
| Write a new lesson | Content → Lessons → **New** → fill in → **Published + Publish now** |
| Keep work private until ready | Leave **Status: Draft**, then click **Save** |
| Make content Premium-only | In the editor, set **Access: Premium** |
| Undo a bad edit | Editor → **Versions** → **Restore** → **Save** |
| Monthly update | Add content, then Content → Releases → **New** to list what's new |
| Let people sign up themselves | Settings → **Allow self-registration** (new accounts get the Free plan) |
| Add another admin | Administrators → **Add administrator** (Super Admin only) |

**Publishing:** learners don't read your content collections directly. When you click **Publish now**, Xuélù builds one package per plan. Learners download their package once, and after that it works offline. The button turns red whenever you have changes that learners can't see yet.

## Audio

Every word and sentence plays with the device's Chinese voice, which works offline.

To use your own recordings: **Content → Audio → New**. Type the exact Chinese text, then paste a link to the MP3. The file can be hosted anywhere, including your GitHub repository. From then on, that recording plays instead of the device voice. Uploading files directly needs Firebase Storage, which requires the Blaze plan.

## Free-plan limits (Spark)

- 50,000 document reads a day.
- 20,000 writes a day.
- 1 GB of storage.

A learner opening the app uses about 5–10 reads, because content arrives as a package. Hundreds of daily learners fit comfortably.
