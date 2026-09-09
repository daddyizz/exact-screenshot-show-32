# Roadmap — BlogPilot AI

## Selesai
- Auth (Google sign-in) + redirect balik ke halaman asal
- Pangkalan data teras: profiles, blogs, posts, blogger_connections, user_roles + RLS
- Dashboard, content queue & pustaka Articles (edit + terbit semula)
- AI: jana topik, jana artikel (SEO title/meta/keywords), AI images
- Blogger: OAuth flow, pilih blog, publish artikel
- Blogger OAuth di-harden supaya boleh guna redirect URI tetap dari server (`BLOGGER_REDIRECT_URI`)
- Blogger OAuth production telah dikonfigurasi pada domain semasa
- Autopilot: enjin, suis on/off, auto-publish, Run autopilot now
- Autopilot berjalan sendiri bila buka Overview (blog yang dah tiba masanya)
- Endpoint jadual harian /api/public/cron/autopilot (untuk scheduler luar)
- Slot iklan (landing, workspace, dashboard)
- Landing: pricing + FAQ
- Billing foundation migration: `user_subscriptions`, `monthly_usage`, Free/Pro status + RLS
- Legacy-compatible plan storage melalui Supabase `app_metadata` bila billing table/RPC belum tersedia pada database semasa
- Free plan: 5 AI drafts/bulan; AI cover image dan Autopilot dikunci kepada Pro
- Pro plan: unlimited AI drafts, AI cover images dan Autopilot
- Manual Free/Pro + active/trialing/past_due/canceled/suspended management dari Admin
- Admin console: overview, users, search/filter, invite user, edit user, plan/status, Admin/Moderator roles, plans & usage
- Admin delete-user dengan perlindungan supaya admin tidak boleh delete akaun sendiri
- Admin console mempunyai fallback untuk database lama supaya page tidak crash jika billing RPC/table belum tersedia
- React hook-order crash pada `/admin` telah dibetulkan
- Schema mismatch `autopilot_auto_publish` disediakan dalam migration dan code kini toleran pada schema lama

## Tinggal
- Stripe checkout sebenar: `STRIPE_SECRET_KEY`, Stripe Pro Price ID (RM49/bulan), webhook secret, Checkout + Customer Portal + webhook lifecycle
- Apply billing migration penuh pada database auth asal apabila akses migration/database tersedia; sehingga itu compatibility mode menggunakan `app_metadata`
- Enforce had bilangan blog (Free 1 / Pro 5) pada database auth asal melalui trigger migration; AI dan Autopilot sudah mempunyai server-side plan enforcement
- Paparkan plan/usage ringkas pada dashboard pengguna
- Audit end-to-end live selepas sync: invite/edit/delete user, manual Free/Pro, AI draft limit, AI image Pro, Autopilot Pro, Blogger publish
