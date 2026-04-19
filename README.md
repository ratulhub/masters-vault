# 🔐 Master's Vault

> A zero-knowledge, client-side encrypted password manager — your secrets never leave your browser unencrypted.

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Made with Vanilla JS](https://img.shields.io/badge/Built%20With-Vanilla%20JS-yellow)
![Encryption](https://img.shields.io/badge/Encryption-AES--256--GCM%20%2B%20Argon2id-blue)
![Storage](https://img.shields.io/badge/Backend-Supabase-3ECF8E?logo=supabase)

**Master's Vault** stores passwords, secure notes, crypto wallets, and card details — all encrypted in your browser with **Argon2id + AES-256-GCM** before being synced to Supabase. Even if someone steals your database, they get nothing but random noise.

---

## ✨ Features

- 🔑 **Zero-Knowledge Encryption** — Argon2id key derivation + AES-256-GCM. Server never sees your data.
- 🧠 **Panic Mode** — Enter a decoy password to silently wipe your real vault from the server.
- 🕵️ **Auto-Lock** — Locks after 2 minutes of inactivity or when tab loses focus.
- 📋 **Auto-Clear Clipboard** — Copies auto-clear after 20 seconds.
- 🗂️ **4 Vault Categories** — Logins, Secure Notes, Crypto Wallets, Cards & IDs.
- 🔒 **Password Change** — Re-encrypts your entire vault under a new master password.
- 🌐 **Works Offline** (read-only) — In-memory cache survives brief disconnects.

---

```markdown
## 🚀 Live Demo

**[master-vault-test.netlify.app](https://master-vault-test.netlify.app)**

| | |
|---|---|
| 🔑 Master Password | `testpassword` |
| 💀 Panic Password | `panictest123` |

> ⚠️ This is a shared demo vault. Do not store real passwords here.
```
---

## 🛠️ Setup Guide

### Prerequisites

- A free [Supabase](https://supabase.com) account
- A free [Netlify](https://netlify.com) account (or any static host)
- A text editor (VS Code recommended)

---

### Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **Start your project** → Sign in with GitHub.
2. Click **New Project**, give it a name (e.g., `masters-vault`), set a database password, pick a region near you.
3. Wait ~2 minutes for the project to spin up.

---

### Step 2 — Get Your API Keys

1. In your Supabase dashboard, click **Project Settings** (gear icon, bottom left).
2. Click **API** in the left menu.
3. Copy your **Project URL** and **anon / public** API Key. Keep this tab open.

---

### Step 3 — Set Up the Database Table

1. In your Supabase dashboard, click **SQL Editor** (the `</>` icon in the left sidebar).
2. Click **New Query**.
3. Open the `supabase_setup.sql` file from this repo, copy all of it, paste it in, and click **Run**.
4. You should see `Success. No rows returned.` — the table is ready.

---

### Step 4 — Add Your Keys to the Code

1. Open `src/store.js` in a text editor.
2. Find lines 4–5 at the top:
   ```js
   const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
   ```
3. Replace them with the values you copied in Step 2. Save the file.

---


### Step 5 — Deploy to Netlify (Free)

#### Option A — Drag & Drop (Easiest, no Git needed)

1. Go to [netlify.com](https://netlify.com) → Log in → Click **Add new site → Deploy manually**.
2. Drag your entire project folder into the upload area.
3. Done! Netlify gives you a live URL instantly.

#### Option B — Deploy from GitHub (Recommended for updates)

1. Push this repo to your GitHub account.
2. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**.
3. Connect GitHub, select your repository.
4. Leave all build settings blank (this is a static site — no build command needed).
5. Click **Deploy site**. Done!

> 💡 **Custom Domain:** In Netlify → Domain settings → Add custom domain. It's free with automatic HTTPS.

---

### Step 6 — First Launch

1. Open your Netlify URL in a browser.
2. The lock screen will say **"Set Master Password"** — this only happens once.
3. Type a strong master password and click **Initialize Vault**.
4. ⚠️ **Write this password down somewhere safe. If you forget it, your data is permanently unrecoverable.**

---
## 🔄 Reset Vault (Start From Zero)

If you forget your master password, your encrypted data is permanently unrecoverable. However, you can wipe everything and start fresh.

**Step 1 — Delete the database table** by running this in your Supabase SQL Editor:

```sql
DROP POLICY IF EXISTS "Enable read access for all users" ON public.vault_items;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.vault_items;
DROP POLICY IF EXISTS "Enable update for all users" ON public.vault_items;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.vault_items;
DROP TABLE IF EXISTS public.vault_items;
```

**Step 2 — Re-run** `supabase_setup.sql` to recreate the empty table.

**Step 3 — Clear localStorage** in your browser by opening DevTools (`F12`) → Application → Local Storage → select your site → Click **Clear All**.

**Step 4 —** Reload the app. It will say **"Set Master Password"** again — you're starting fresh.

> ⚠️ This permanently destroys all previously stored vault data. There is no recovery.

## 🗂️ Project Structure

```
masters-vault/
├── index.html          # App shell & all screens
├── style.css           # Full dark-mode UI
├── supabase_setup.sql  # Run this once in Supabase SQL Editor
└── src/
    ├── main.js         # Entry point, auth logic
    ├── crypto.js       # Argon2 + AES-GCM encryption layer
    ├── store.js        # Supabase sync & local cache  ← add your keys here
    └── ui.js           # All rendering & user interactions
```

---

## 🔒 Security Model

| Layer | Technology | Purpose |
|---|---|---|
| Key Derivation | Argon2id (64MB, 2 iter) | Brute-force resistant master key |
| Encryption | AES-256-GCM | Authenticated encryption per item |
| Owner Isolation | SHA-256 hash of password+salt | Fetches only your rows from DB |
| Transport | HTTPS (Supabase + Netlify) | Encrypted in transit |
| Panic Mode | Decoy hash in localStorage | Wipes real vault on coercion |

> **The Supabase database only ever stores ciphertext.** Even Anthropic, Supabase, or a hacker with full DB access cannot read your passwords.

---

## ⚙️ Optional: Panic Mode

1. After unlocking, click **Settings**.
2. Under **Panic Mode**, enter a different password and click **Enable Panic Mode**.
3. If you are ever forced to open your vault, type the **Panic Password** instead of the real one.
4. It will silently **delete your entire real vault** from Supabase and open an empty decoy.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'Add some feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for full text.

```
Copyright (c) 2025 MD. Abdur Rahim Ratul

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## ⭐ Get More Stars

If this project helped you, please consider:

- ⭐ **Starring this repo** — it helps others discover it!
- 🔁 **Sharing on Twitter/X** with `#OpenSource #Security #JavaScript`
- 📝 **Writing a blog post or Dev.to article** linking back here
- 💬 **Posting in r/selfhosted, r/webdev, r/netsec** — this kind of self-hosted, zero-knowledge tool is exactly what those communities love
- 🗣️ **Mentioning it in Discord servers** for developers and privacy enthusiasts

---

<p align="center">Built with ❤️ by <a href="https://github.com/ratulhub">ratulhub</a></p>
