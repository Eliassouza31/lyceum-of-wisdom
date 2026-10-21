# Fase 8 — Segurança e monitoramento de erros

Status: **código pronto**, testado pelo CI num Supabase local.
Falta: aplicar a migração no Supabase da nuvem (eu faço, com o seu OK) e criar a conta gratuita no **Sentry** (passo a passo abaixo).

## O que mudou (em palavras simples)

1. **Monitoramento de erros (Sentry):** quando algo quebra no site (no navegador ou no servidor), o Sentry guarda os detalhes e te manda um e-mail. Antes, só dava para ver os erros procurando nos logs da Vercel.
2. **Limite de tentativas:** um robô não consegue mais testar milhares de senhas, criar contas em massa ou disparar e-mails de "esqueci a senha" sem parar. Passou do limite, a pessoa vê _"Too many attempts. Please wait a few minutes and try again."_
3. **Escudo contra scripts maliciosos (CSP):** o navegador só roda código vindo do próprio site. Se alguém conseguir injetar um script de outro endereço, o navegador bloqueia.
4. **Descadastro mais protegido:** o link de descadastro dos e-mails só funciona passando pelo site (com limite de tentativas). Antes dava para chamar o banco direto com a chave pública.
5. **Bibliotecas vigiadas:** o CI agora falha se uma biblioteca usada no site tiver uma falha grave conhecida, e o GitHub (Dependabot) abre PRs de atualização toda semana.

### Limites de tentativas

| Ação                         | Limite                                   |
| ---------------------------- | ---------------------------------------- |
| Login                        | 20 por IP e 10 por e-mail, a cada 15 min |
| Criar conta                  | 10 por IP por hora                       |
| "Esqueci a senha"            | 10 por IP e 3 por e-mail, por hora       |
| Descadastro (link do e-mail) | 30 por IP a cada 10 min                  |

Os limites ficam em `src/lib/rate-limit.ts`. O banco guarda só um código embaralhado (hash) do IP e do e-mail, nunca o valor real. Se o contador falhar por algum motivo, o site deixa a pessoa passar (e avisa no Sentry), para nunca trancar todo mundo para fora.

## O que foi construído

| Funcionalidade                                          | Onde está                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Tabela e função de limite de tentativas                 | `supabase/migrations/20261025000000_security.sql`                              |
| Limites no login, cadastro, senha e descadastro         | `src/lib/rate-limit.ts`, `src/features/auth/actions.ts`                        |
| Sentry no navegador e no servidor                       | `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/lib/sentry.ts` |
| Erros registrados pelo `logger.error` vão para o Sentry | `src/lib/logger.ts`                                                            |
| Tela de erro geral                                      | `src/app/global-error.tsx`                                                     |
| Cabeçalho CSP e demais cabeçalhos de segurança          | `next.config.ts`                                                               |
| `npm audit` no CI e Dependabot                          | `.github/workflows/ci.yml`, `.github/dependabot.yml`                           |

**Privacidade no Sentry:** antes de enviar um erro, o site apaga cookies, senhas, chaves, IPs, e-mails e os códigos dos links (descadastro, confirmação). O Sentry só funciona quando a variável `NEXT_PUBLIC_SENTRY_DSN` existe; no seu computador e no CI ele fica desligado.

---

## O que você precisa fazer (≈ 15 minutos, depois do merge)

### 1. Aplicar a migração no Supabase da nuvem (eu faço)

Depois que você disser **"pode aplicar"**, eu aplico pelo conector. Ela cria a tabela de tentativas e fecha o acesso direto às funções de descadastro. Não mexe em clientes, agendamentos nem planos.

### 2. Criar a conta no Sentry

1. Abra https://sentry.io/signup/ e crie a conta (pode entrar com o GitHub).
2. Se perguntar a região dos dados, escolha **United States**.
3. Quando pedir para criar um projeto, escolha a plataforma **Next.js**.
4. Em **Alert frequency**, deixe **Alert me on every new issue**.
5. Dê o nome `lyceum-of-wisdom` ao projeto e clique em **Create Project**.
6. O Sentry vai mostrar um assistente de instalação (comandos `npx`). **Pode ignorar**: o código já está pronto.

### 3. Copiar o DSN

1. No Sentry, abra **Settings** (engrenagem) → **Projects** → `lyceum-of-wisdom` → **Client Keys (DSN)**.
2. Copie o valor do campo **DSN**. Ele parece com `https://abc123@o456.ingest.us.sentry.io/789`.

O DSN não é segredo (ele vai para o navegador de qualquer forma), mas não precisa colar no chat.

### 4. Colocar o DSN na Vercel

1. Na Vercel, abra o projeto **lyceum-of-wisdom** → **Settings** → **Environment Variables**.
2. Clique em **Add New** e preencha:
   - **Key:** `NEXT_PUBLIC_SENTRY_DSN` (confira letra por letra)
   - **Value:** o DSN copiado
   - **Environments:** marque **Production** (pode marcar Preview também)
   - Tipo: pode ser normal (não precisa marcar **Sensitive**), igual ao `NEXT_PUBLIC_APP_URL`
3. Clique em **Save**.
4. Vá em **Deployments**, clique nos **três pontinhos** do deploy mais recente → **Redeploy**. Sem o Redeploy a variável não entra no site.

### 5. Testar

Depois do Redeploy, me avise. Eu te passo um jeito simples de provocar um erro de teste e conferir que ele aparece em **Issues** no Sentry e no seu e-mail.

---

## Para depois (Fase 9)

- **Proteção contra senhas vazadas** do Supabase: o alerta do Supabase recomenda ligar, mas ela só existe no plano Pro, que vamos contratar na publicação.
- **Stack traces legíveis no Sentry** (envio de _source maps_): precisa de um token do Sentry na Vercel (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`). Opcional; os erros já chegam sem isso.
