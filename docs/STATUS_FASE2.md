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
| 7 | Stripe — médico direto (trial + assinatura + suspensão) | ❌ Pendente | Só trial hardcoded no banco; sem checkout, sem webhook Stripe |
| 8 | Painel da farmácia + convite de médicos | ✅ Feito | N farmácias/médico via `pharmacy_doctors` |
| 9 | Stripe — farmácias (pacotes de seats) | ❌ Pendente | Sem checkout, sem webhook, seats hardcoded |
| 10 | 2FA por e-mail (Resend) | ❌ Pendente | Login libera direto, sem OTP |
| 11 | Notificações e-mail + in-app | 🟡 Parcial | In-app ✅ · E-mail: convite ✅, prescrição para farmácia ✅, demais gatilhos (trial, suspensão, sessão derrubada) ❌ |
| 12 | Painel `/admin` completo | 🟡 Parcial | Backend ✅ (usuários, farmácias, ativos, alertas, stats) · Frontend `/admin` não existe |
| 13 | LGPD — exportação + solicitação de exclusão | 🟡 Parcial | Exclusão via `mailto:` ✅ · Exportação CSV de dados do médico ❌ |
| 14 | Sessão única (`current_session_id`) | ❌ Pendente | Middleware não valida session_id; múltiplas sessões simultâneas possíveis |

---

## FASE 2 — Módulo de Atualizações de Conteúdo Clínico (etapas 15–25)

| # | Item | Status | Observação |
|---|------|--------|------------|
| 15 | Tabelas: `actives`, `protocol_versions`, `active_changes_log`, `safety_alerts_urgent`, `active_preview_sessions`, `active_usage_stats` | 🟡 Parcial | `actives` ✅ · `safety_alerts_urgent` ✅ · `protocol_versions`, `active_changes_log`, `active_preview_sessions`, `active_usage_stats` ❌ (não criadas) |
| 16 | Migrar ativos do system prompt para o banco | ❓ A verificar | Tabela `actives` existe e é consultada; confirmar se dados foram populados |
| 17 | Endpoint de injeção dinâmica na API | ✅ Feito | `actives` filtrados por preferências do médico e injetados no contexto a cada geração |
| 18 | Painel `/admin/ativos` — listagem + formulário + publicação | 🟡 Parcial | Backend: CRUD + publish + discontinue ✅ · Frontend: página não existe |
| 19 | Modal de pré-visualização (chamada real à API) | ❌ Pendente | Sem frontend e sem endpoint dedicado |
| 20 | Sistema de versões do protocolo + rollback | ❌ Pendente | Tabela `protocol_versions` não criada; sem endpoints; sem frontend |
| 21 | Importação e exportação CSV de ativos | ❌ Pendente | — |
| 22 | Alertas urgentes + banner bloqueante no login | 🟡 Parcial | Backend: CRUD `safety_alerts_urgent` ✅ · Frontend: sem página `/admin/alertas`, sem banner no login |
| 23 | Analytics de uso de ativos (`/admin/analytics`) | ❌ Pendente | Tabela `active_usage_stats` não criada; sem extração de ativos do output; sem dashboard |
| 24 | Tag `[DESCONTINUADO]` no histórico de prescrições | ❌ Pendente | — |
| 25 | Cron job de backup semanal CSV | ❌ Pendente | — |

---

## MIGRAÇÃO SQL PENDENTE (Supabase)

Itens que precisam rodar no SQL Editor antes de funcionar:

```sql
-- Adicionado na sessão atual (filtro por data de finalização)
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

-- Fase 2 — a criar quando iniciar módulo de atualizações
CREATE TABLE IF NOT EXISTS protocol_versions ( ... );
CREATE TABLE IF NOT EXISTS active_changes_log ( ... );
CREATE TABLE IF NOT EXISTS active_preview_sessions ( ... );
CREATE TABLE IF NOT EXISTS active_usage_stats ( ... );
```

---

## ORDEM SUGERIDA PARA PRÓXIMAS SPRINTS

### Sprint A — Pagamentos (desbloqueador de receita)
1. Stripe checkout médico direto (trial → pago)
2. Webhook `invoice.payment_failed` → suspensão no dia 3
3. Stripe farmácias — checkout por pacote de seats
4. Página `/pagamento-pendente` (bloqueio quando suspenso)

### Sprint B — Segurança crítica
5. Sessão única: gravar `current_session_id` no login, validar no middleware
6. 2FA por e-mail via Resend (OTP 6 dígitos, expira em 10 min)

### Sprint C — Admin frontend
7. Página `/admin` com lista de médicos, farmácias e métricas
8. Página `/admin/ativos` — listagem + formulário + publicar/descontinuar
9. Página `/admin/alertas` + banner bloqueante no login dos médicos

### Sprint D — Módulo de atualizações completo
10. Tabelas `protocol_versions`, `active_changes_log`, `active_preview_sessions`, `active_usage_stats`
11. Modal de pré-visualização de ativo (gera prescrição de teste)
12. Sistema de versões do protocolo + rollback
13. Importação/exportação CSV de ativos
14. Analytics de uso de ativos
15. Tag `[DESCONTINUADO]` no histórico

### Sprint E — Qualidade e compliance
16. Restante dos gatilhos de e-mail (trial expirando, suspensão, sessão derrubada)
17. Exportação LGPD — CSV de dados do médico
18. Cron job de backup semanal

---

*Medrion · Status v1.1 · Maio 2026*
