# Admin panel language: Uzbek (oʻzbekcha)

The Averna administrator is a native Uzbek speaker, so **all admin-only UI must be
written in Uzbek (Latin script)**.

## Scope
- Applies to every admin-only surface:
  - Pages under `app/admin/**`
  - The `ADMIN_NAV` section of `components/layout/app-sidebar.tsx` and the "Admin paneli" portal label
  - Admin-only components (e.g. `components/admin/**`)
  - Admin commands in the `⌘K` command palette (`components/command-palette.tsx`)
- Student and Teacher UI stays in English (do not translate shared pages like
  `/messages`, `/notifications`, `/settings` beyond their admin-facing labels).

## Conventions
- Use proper Uzbek Latin orthography: `oʻ`/`gʻ` use the modifier letter `ʻ` (U+02BB),
  and the tutuq belgisi `ʼ` (U+02BC) for words like `eʼlon`, `maʼlumot`.
- Keep proper nouns/brand names as-is: **Averna**, **IELTS**, **CEFR** codes (A2, B1…),
  and band numbers.
- Keep technical/config values (routes, env var names, code identifiers) unchanged.

## Glossary (for consistency)
- Dashboard → Boshqaruv paneli
- Students → Oʻquvchilar · Teachers → Oʻqituvchilar · Groups → Guruhlar
- Analytics → Tahlil · Finance → Moliya · Announcements → Eʼlonlar
- Rewards → Mukofotlar · Content → Kontent · System → Tizim
- Audit Log → Audit jurnali · Messages → Xabarlar · Notifications → Bildirishnomalar
- Save → Saqlash · Delete → Oʻchirish · Edit → Tahrirlash · Search → Qidirish
