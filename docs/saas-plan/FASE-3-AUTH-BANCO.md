# Fase 3 — Autenticação e banco de dados

Status: **código pronto e testado** num Supabase local (o mesmo software do Supabase na nuvem, rodando em Docker).
Falta apenas **criar o projeto Supabase na nuvem** e ligar à Vercel. Isso depende da sua conta (passo a passo abaixo).

## O que foi construído

| Funcionalidade                                                                             | Onde está                                                   |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Tabelas `profiles`, `businesses`, `business_members` + segurança por linha (RLS)           | `supabase/migrations/20261020000000_tenancy_foundation.sql` |
| Função `create_business` (cria empresa + dono de forma atômica; 1 empresa por dono no MVP) | mesma migração                                              |
| Perfil criado automaticamente no cadastro                                                  | trigger `on_auth_user_created`                              |
| Cadastro com confirmação por e-mail                                                        | `/signup`, `src/features/auth/`                             |
| Login, logout, "esqueci a senha", redefinição de senha                                     | `/login`, `/forgot-password`, `/reset-password`             |
| Retorno dos links de e-mail (PKCE e token_hash)                                            | `src/app/auth/confirm/route.ts`                             |
| Onboarding da empresa (nome + fuso horário dos EUA)                                        | `/onboarding`                                               |
| Área logada com menu lateral (desktop) e menu sanduíche (celular)                          | `src/app/(app)/layout.tsx`                                  |
| Dashboard inicial com checklist de configuração                                            | `/dashboard`                                                |
| Proteção de rotas e renovação de sessão                                                    | `src/proxy.ts`                                              |
| Bloqueio de _open redirect_ (`?next=https://site-malicioso`)                               | `src/lib/auth/redirects.ts`                                 |
| Tipos TypeScript gerados a partir do banco                                                 | `src/types/database.types.ts`                               |

### Decisões de segurança

- **Negar por padrão:** visitantes anônimos não têm nenhum acesso às tabelas; usuários logados só recebem as permissões mínimas (ex.: não podem inserir empresas diretamente nem alterar `created_by`).
- **RLS em todas as tabelas:** um usuário só enxerga a empresa da qual é membro. Isso é garantido pelo banco, não só pela tela.
- **Mensagens que não vazam informação:** "esqueci a senha" responde igual para e-mails existentes e inexistentes.
- **Sessão verificada no servidor** com `getClaims()` (valida a assinatura do token).
- **Senha:** mínimo de 8 caracteres, com letras e números (validado no navegador, no servidor e no Supabase).

## Testes executados (resultados reais)

| Suíte                                                                                                               | Comando                    | Resultado                                   |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------- |
| Unitários (validação, redirecionamentos, mensagens de erro, fusos)                                                  | `npm test`                 | **31 passaram**                             |
| Integração — isolamento entre empresas (RLS)                                                                        | `npm run test:integration` | **13 passaram**                             |
| Ponta a ponta no navegador (cadastro → e-mail → onboarding → dashboard → logout → login → redefinir senha; celular) | `npm run test:e2e`         | **12 passaram**                             |
| Lint do banco (Supabase)                                                                                            | `npm run db:lint`          | sem problemas                               |
| Build de produção                                                                                                   | `npm run build`            | ok (inclusive **sem** Supabase configurado) |

**Prova de que os testes de RLS funcionam:** desativei temporariamente a RLS da tabela `businesses` e rodei a suíte — 4 testes falharam, como esperado. Reativei e todos voltaram a passar.

Os testes de integração e ponta a ponta também rodam no GitHub Actions a cada push (job "Database (RLS) and end-to-end tests").

---

## O que você precisa fazer (≈ 20 minutos)

### 1. Criar o projeto no Supabase

1. Acesse https://supabase.com/dashboard e clique em **New project**.
2. **Name:** `reminder-app-prod` · **Region:** `East US (North Virginia)` (mais perto dos clientes americanos).
3. **Database Password:** clique em **Generate a password** e **guarde num gerenciador de senhas**.
4. Clique em **Create new project** e aguarde ~2 minutos.

### 2. Aplicar as tabelas e regras de segurança

**Opção A — eu faço por você (recomendado):** conecte o conector do Supabase em claude.ai (**Settings → Connectors → Supabase**) e me avise. Eu aplico a migração e confiro tudo.

**Opção B — você faz pelo PowerShell**, dentro da pasta do projeto:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

O `SEU_PROJECT_REF` é o código que aparece na URL do painel: `https://supabase.com/dashboard/project/SEU_PROJECT_REF`.

### 3. Configurar a autenticação no painel do Supabase

Em **Authentication → URL Configuration**:

- **Site URL:** o endereço da Vercel (ex.: `https://reminder-app.vercel.app`)
- **Redirect URLs:** adicione `https://SEU-ENDERECO.vercel.app/**`

Em **Authentication → Sign In / Providers → Email**:

- **Confirm email:** ligado
- **Minimum password length:** `8`
- **Password requirements:** `Letters and digits`

### 4. Pegar as chaves e colocar na Vercel

1. No Supabase: **Project Settings → API Keys**. Copie a **Project URL** e a **Publishable key** (começa com `sb_publishable_`).
   **Nunca** copie a _secret key_ para variáveis `NEXT_PUBLIC_`.
2. Na Vercel: **Project → Settings → Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Publishable key
   - `NEXT_PUBLIC_APP_URL` = endereço da Vercel (sem `/` no final)
3. Em **Deployments**, clique nos três pontos do último deploy → **Redeploy** (variáveis `NEXT_PUBLIC_` só valem após um novo build).

### 5. Testar

1. Abra o endereço da Vercel → **/signup** → crie uma conta com seu e-mail real.
2. Abra o e-mail "Confirm your email address" e clique no link.
3. Preencha o nome da empresa e o fuso → deve aparecer o dashboard "Welcome, …".

## ⚠️ Limite de e-mails do Supabase

O envio de e-mails padrão do Supabase serve só para testes: permite **poucos e-mails por hora**. Antes de receber clientes, configuraremos o Resend como servidor SMTP do Supabase (Fase 6). Até lá, se o e-mail de confirmação não chegar, aguarde alguns minutos.

## Rodar os testes de banco no seu computador (opcional)

Exige o **Docker Desktop** instalado. Não é necessário para usar o sistema — o GitHub Actions já roda esses testes.

```powershell
npm run db:start
npm run test:integration
npm run test:e2e
npm run db:stop
```
