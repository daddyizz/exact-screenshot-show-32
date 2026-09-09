# Roadmap — BlogPilot AI

## Selesai
- Auth (Google sign-in) + redirect balik ke halaman asal
- Pangkalan data: profiles, blogs, posts, blogger_connections, user_roles + RLS
- Dashboard, content queue & pustaka Articles (edit + terbit semula)
- AI: jana topik, jana artikel (SEO title/meta/keywords), AI images
- Blogger: OAuth flow, pilih blog, publish artikel
- Blogger OAuth di-harden supaya boleh guna redirect URI tetap dari server (`BLOGGER_REDIRECT_URI`)
- Autopilot: enjin, suis on/off, auto-publish, Run autopilot now
- Autopilot berjalan sendiri bila buka Overview (blog yang dah tiba masanya)
- Endpoint jadual harian /api/public/cron/autopilot (untuk scheduler luar)
- Slot iklan (landing, workspace, dashboard)
- Landing: pricing + FAQ
- Billing foundation: `user_subscriptions`, `monthly_usage`, Free/Pro status + RLS
- Free plan enforcement: maksimum 1 blog, 5 AI drafts/bulan, tiada Autopilot
- Pro plan enforcement: maksimum 5 blog, Autopilot + AI cover images
- Akaun owner/admin utama ditetapkan sebagai Pro aktif secara manual
- Admin console diperluas: overview, users, search/filter, invite user, edit user, plan/status, roles, billing & usage
- Schema mismatch `autopilot_auto_publish` dibetulkan di production dan migration

## Tinggal konfigurasi luar
- Stripe checkout sebenar: perlukan `STRIPE_SECRET_KEY`, Stripe Pro Price ID (RM49/bulan) dan webhook secret
- Blogger OAuth production: masukkan `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `BLOGGER_REDIRECT_URI` pada hosting dan daftarkan redirect URI yang sama di Google Cloud OAuth client

## Cadangan selepas konfigurasi
- Stripe Checkout + Customer Portal + webhook lifecycle (active/past_due/canceled)
- Paparkan plan/usage pada dashboard pengguna
- Audit end-to-end live: Free limit, Pro upgrade, Blogger connect, Autopilot publish
