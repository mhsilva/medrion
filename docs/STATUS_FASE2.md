# Medrion — Status de Implementação · Maio 2026

> Documento vivo. Atualizar conforme cada item for entregue.

---

## FASE 1 — Briefing Técnico Principal (etapas 1–14)

| # | Item | Status | Observação |
|---|------|--------|------------|
| 1 | Auth Supabase + banco completo | ✅ Feito | — |
| 2 | Onboarding médico + aceite legal | ✅ Feito | — |
| 3 | Cadastro de pacientes + formulário | ✅ Feito | — |
| 4 | Módulo de exames (upload/formulário/texto) | ✅ Feito | — |
| 5 | Integração Anthropic + geração .docx | ✅ Feito | Cache `1h` ativo |
| 6 | Editor TipTap + handoff clínico + chat | ✅ Feito | — |
| 7 | Stripe — médico direto (trial + assinatura + suspensão) | ✅ Feito | Checkout, Customer Portal, webhooks `invoice.payment_failed`, `subscription.*` |
| 8 | Painel da farmácia + convite de médicos | ✅ Feito | N farmácias/médico via `pharmacy_doctors` |
| 9 | Stripe — farmácias (pacotes de seats) | ✅ Feito | Onboarding step 3 com checkout dos pacotes 10/20/30 |
| 10 | 2FA por e-mail (Resend) | ✅ Feito | OTP 6 dígitos, 10min TTL, lock 30min após 5 tentativas |
| 11 | Notificações e-mail + in-app | ✅ Feito | In-app + e-mails: convite, prescrição, payment_failed, suspended, reactivated, OTP, trial-d6/d7, sessão derrubada (parcial — gatilho de "novo dispositivo" depende de detectar mismatch no cliente) |
| 12 | Painel `/admin` completo | ✅ Feito | Dashboard, Médicos, Farmácias, Ativos, Alertas, Protocolo, Analytics, Logs |
| 13 | LGPD — exportação + solicitação de exclusão | ✅ Feito | `/perfil` → "Exportar meus dados" gera CSV (perfil + pacientes + prescrições) |
| 14 | Sessão única (`current_session_id`) | ✅ Feito | Header `X-Session-Id` validado no middleware; mismatch → 401 |

---

## FASE 2 — Módulo de Atualizações de Conteúdo Clínico (etapas 15–25)

| # | Item | Status | Observação |
|---|------|--------|------------|
| 15 | Tabelas: `actives`, `protocol_versions`, `active_changes_log`, `safety_alerts_urgent`, `active_preview_sessions`, `active_usage_stats` | ✅ Feito | Todas no schema 001; 002 adiciona `current_session_id`, `mfa_verified_at`, `otp_codes`, `prescriptions.finalized_at` |
| 16 | Migrar ativos do system prompt para o banco | ❓ Operacional | Tabela está pronta — basta o admin popular via UI ou import CSV |
| 17 | Endpoint de injeção dinâmica na API | ✅ Feito | `actives` filtrados por preferências do médico e injetados no contexto |
| 18 | Painel `/admin/ativos` — listagem + formulário + publicação | ✅ Feito | Backend CRUD completo + frontend com 4 blocos, publish/discontinue, histórico de alterações, reason no edit publicado |
| 19 | Modal de pré-visualização (chamada real à API) | ✅ Feito | `POST /admin/actives/{id}/preview` chama Anthropic com ativo em rascunho; modal com "Aprovar e publicar" |
| 20 | Sistema de versões do protocolo + rollback | ✅ Feito | `/admin/protocolo` com criar/publicar/rollback (motivo obrigatório) |
| 21 | Importação e exportação CSV de ativos | ✅ Feito | Import vira tudo `draft`; duplicatas viram "(importado [data])"; export filtra `status=active` |
| 22 | Alertas urgentes + banner bloqueante no login | ✅ Feito | CRUD em `/admin/alertas` + `<SafetyAlertBanner>` modal "Li e estou ciente" no Layout, registra notificação `safety_alert` ao dispensar |
| 23 | Analytics de uso de ativos (`/admin/analytics`) | ✅ Feito | Parser por `commercial_name` no `finalize_prescription` popula `active_usage_stats`; dashboard com top 20 + breakdown por fornecedor/categoria |
| 24 | Tag `[DESCONTINUADO]` no histórico de prescrições | ✅ Feito | `GET /prescriptions/{id}/discontinued-actives` cruza nomes e renderiza banner laranja em `/prescricoes/:id` |
| 25 | Cron job de backup semanal CSV | ✅ Feito | `GET /cron/weekly-backup` (X-Cron-Secret) faz upload em `Storage/backups/`, retém 12 |

---

## SETUP MANUAL FORA DO CÓDIGO

### Supabase
1. Rodar `supabase/migrations/002_phase2_security.sql` no SQL Editor
2. Criar bucket privado `backups` no Storage para o cron de backup semanal

### Stripe Dashboard
1. Criar 4 prices (BRL, recurring monthly):
   - `STRIPE_PRICE_DOCTOR` — R$ 497/mês
   - `STRIPE_PRICE_PHARMACY_10` — R$ 2.900/mês
   - `STRIPE_PRICE_PHARMACY_20` — R$ 4.800/mês
   - `STRIPE_PRICE_PHARMACY_30` — R$ 6.300/mês
2. Configurar webhook endpoint: `https://<railway-url>/billing/webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`, `invoice.paid`
3. Configurar Smart Retries do Stripe para "3 dias e cancelar" (Settings → Subscriptions → Manage failed payment retries)
4. Copiar `Webhook Signing Secret` para `STRIPE_WEBHOOK_SECRET`

### Railway
- Adicionar env vars: `STRIPE_*`, `RESEND_API_KEY`, `CRON_SECRET`
- Configurar Railway Cron:
  - Diário 09:00 UTC: `GET /cron/trial-reminders` (header `X-Cron-Secret: <CRON_SECRET>`)
  - Domingos 03:00 UTC: `GET /cron/weekly-backup`

### Frontend (Cloudflare Pages)
- `VITE_API_URL` → URL do Railway

---

## ARQUIVOS NOVOS NESTA SPRINT

**Backend**
- `app/services/stripe_service.py` — wrapper Stripe
- `app/services/auth_service.py` — OTP + session
- `app/api/billing.py` — checkout, portal, webhook
- `app/api/auth.py` — /auth/start-session, verify-otp, resend-otp
- `app/api/cron.py` — trial reminders + weekly backup
- `app/api/admin.py` — reescrito com schemas corretos + 4 sprints de endpoints
- `supabase/migrations/002_phase2_security.sql`

**Frontend**
- `src/pages/Admin.tsx` — painel completo (8 abas)
- `src/pages/Checkout.tsx`, `PaymentPending.tsx`, `VerifyOtp.tsx`
- `src/components/SafetyAlertBanner.tsx`

---

*Medrion · Status v2.0 · Maio 2026*
