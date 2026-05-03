# Medrion

Plataforma SaaS de prescrição médica inteligente. Médicos geram prescrições completas em .docx em segundos usando IA.

## Estrutura

```
medrion/
├── backend/          # FastAPI (Python) — deploy no Railway
├── frontend/         # React + Vite — deploy no Cloudflare Pages
├── supabase/
│   └── migrations/   # Schema SQL
└── docs/             # Documentação do produto
```

## Stack

| Camada | Tech |
|--------|------|
| Frontend | React 18 + Vite + TypeScript + Tailwind |
| Backend | Python 3.12 + FastAPI |
| Banco | Supabase (Postgres + Auth + Storage) |
| IA | Anthropic Claude (Sonnet para prescrições, Haiku para OCR) |
| Pagamentos | Stripe |
| Email | Resend |
| Deploy Frontend | Cloudflare Pages |
| Deploy Backend | Railway |

## Setup local

### Supabase
1. Criar projeto em [supabase.com](https://supabase.com)
2. Executar `supabase/migrations/001_initial_schema.sql` no SQL Editor
3. Ativar Google OAuth em Authentication → Providers
4. Criar buckets: `prescriptions` (privado), `uploads` (privado), `logos` (público)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# preencher .env com as credenciais
uvicorn app.main:app --reload
```

Variáveis necessárias em `backend/.env`:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
FRONTEND_URL=http://localhost:5173
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# preencher .env com as credenciais
npm run dev
```

Variáveis necessárias em `frontend/.env`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:8000
```

## Deploy

### Backend (Railway)
- Conectar repo GitHub, selecionar diretório `backend/`
- Railway detecta o `Dockerfile` automaticamente
- Configurar variáveis de ambiente no painel

### Frontend (Cloudflare Pages)
- Conectar repo GitHub
- Build command: `npm run build`
- Build output: `dist`
- Root directory: `frontend`
- Configurar variáveis de ambiente no painel

## Fases de desenvolvimento

| Fase | Semana | Escopo |
|------|--------|--------|
| MVP Core | 1 | Auth, pacientes, exames, geração de prescrição, .docx |
| Pagamentos | 2 | Stripe trial + assinaturas + farmácias + convites |
| Admin + LGPD | 3 | Painel admin, exportação de dados |
| Ativos + Polimento | 4 | Banco de ativos dinâmico, alertas, analytics |

## Documentação detalhada

Ver [docs/](./docs/) para os documentos técnicos completos do produto.
