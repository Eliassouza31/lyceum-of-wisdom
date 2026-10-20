# Fase 2 — Configuração do ambiente

O esqueleto do projeto já foi criado e testado na nuvem. Agora você vai colocá-lo para rodar **no seu Windows** e publicá-lo na **Vercel**.

Tempo estimado: 2 a 3 sessões de 1 hora.

## O que já está pronto (e foi testado)

| Item                                                      | Arquivo(s)                                  | Como foi verificado                                                                               |
| --------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Projeto Next.js 16 + TypeScript estrito + Tailwind CSS 4  | `package.json`, `tsconfig.json`, `src/app/` | `npm run build` concluído sem erros                                                               |
| Página inicial provisória (em inglês, responsiva)         | `src/app/page.tsx`                          | Aberta em navegador nos tamanhos de celular (390px) e computador (1280px), sem rolagem horizontal |
| Rota de saúde `/api/health`                               | `src/app/api/health/route.ts`               | Respondeu `{"status":"ok"}` com status 200                                                        |
| Cabeçalhos de segurança (HSTS, nosniff, anti-iframe etc.) | `next.config.ts`                            | Conferidos na resposta HTTP                                                                       |
| Validação de variáveis de ambiente com Zod                | `src/lib/env.ts`                            | 3 testes automatizados passando                                                                   |
| Logger estruturado que esconde senhas e tokens            | `src/lib/logger.ts`                         | 3 testes automatizados passando                                                                   |
| Lint (ESLint), formatação (Prettier), checagem de tipos   | `eslint.config.mjs`, `.prettierrc.json`     | `npm run check` sem erros                                                                         |
| CI no GitHub Actions                                      | `.github/workflows/ci.yml`                  | Roda a cada `git push` (confira na aba **Actions** do GitHub)                                     |
| Modelo de variáveis de ambiente (sem segredos)            | `.env.example`                              | —                                                                                                 |
| Finais de linha padronizados (Windows/Linux)              | `.gitattributes`                            | —                                                                                                 |

> O arquivo `AGENTS.md` foi criado automaticamente pelo Next.js; ele orienta assistentes de IA e pode ser mantido.

---

## Passo 1 — Pré-requisitos

Você precisa ter concluído a seção 13 do `PLANO-TECNICO.md`: Git, Node.js LTS e VS Code instalados. Confira no **PowerShell**:

```powershell
git --version
node -v
npm -v
```

O `node -v` deve mostrar **v22.12** ou mais novo (o recomendado é v24).

## Passo 2 — Baixar o projeto para o seu computador

No PowerShell:

```powershell
cd $HOME\projects
git clone https://github.com/Eliassouza31/lyceum-of-wisdom.git reminder-app
cd reminder-app
git checkout claude/saas-scheduling-reminders-3tpfeh
```

Na primeira vez, o Git pode abrir uma janela pedindo login no GitHub. Faça login normalmente.

**Verificação:** o comando `dir` deve listar `package.json`, `src`, `docs` etc.

## Passo 3 — Instalar as dependências

Ainda na pasta `reminder-app`:

```powershell
npm install
```

Leva de 1 a 3 minutos e cria a pasta `node_modules` (ela nunca vai para o Git).
Avisos (`npm warn`) são normais. Se aparecer **`npm error`**, copie a mensagem completa e me envie.

## Passo 4 — Criar o arquivo de variáveis locais

```powershell
Copy-Item .env.example .env.local
```

Por enquanto não precisa editar nada. O `.env.local` é ignorado pelo Git e é onde ficarão as chaves secretas nas próximas fases.

## Passo 5 — Rodar todas as verificações

```powershell
npm run check
```

**Resultado esperado** (no final):

```
 Test Files  2 passed (2)
      Tests  6 passed (6)
```

## Passo 6 — Abrir o aplicativo

```powershell
npm run dev
```

Abra o navegador em **http://localhost:3000**. Deve aparecer a página "Appointment reminders that run themselves".
Abra também **http://localhost:3000/api/health**, que deve mostrar `{"status":"ok"}`.

Para parar o servidor, volte ao PowerShell e pressione **Ctrl + C**.

> Dica: abra a pasta no VS Code com `code .` e use o terminal integrado (menu **Terminal → New Terminal**). Ele é um PowerShell dentro do editor.

## Passo 7 — Publicar na Vercel

1. Acesse https://vercel.com e entre com sua conta do GitHub.
2. Clique em **Add New… → Project**.
3. Encontre o repositório **lyceum-of-wisdom** e clique em **Import**. Se ele não aparecer, clique em **Adjust GitHub App Permissions** e libere o repositório.
4. Em **Framework Preset**, confirme **Next.js**. Não altere os comandos de build.
5. Em **Environment Variables**, adicione:
   - Name: `NEXT_PUBLIC_APP_URL`
   - Value: deixe `http://localhost:3000` por enquanto. Depois do primeiro deploy, troque pelo endereço que a Vercel gerar (ex.: `https://reminder-app-xyz.vercel.app`).
6. Clique em **Deploy**.

> Por padrão a Vercel publica o branch principal (`main`), que ainda não tem o projeto. Na tela do projeto, abra **Deployments** e procure o deploy do branch `claude/saas-scheduling-reminders-3tpfeh` (é um _Preview_). Quando juntarmos este branch ao `main`, o endereço de produção passa a exibir o aplicativo.

**Verificação:** abra o link do deploy, confira se a página aparece e acesse `/api/health`.

## Passo 8 — Conferir o CI no GitHub

No GitHub, abra o repositório → aba **Actions**. O workflow **CI** do último push deve estar com ✅ verde.

---

## Problemas comuns no Windows

| Erro                                                 | Solução                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `'npm' não é reconhecido...`                         | Feche e abra o PowerShell. Se persistir, reinstale o Node.js.                                     |
| `execução de scripts foi desabilitada neste sistema` | Execute uma vez: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` e responda `S`.            |
| `EPERM` ou `EBUSY` no `npm install`                  | Feche o VS Code e outros terminais, rode o PowerShell de novo e repita. Evite pastas do OneDrive. |
| Porta 3000 em uso                                    | Rode `npm run dev -- -p 3001` e abra http://localhost:3001.                                       |

## Observação sobre segurança das dependências

O `npm audit` aponta um alerta no pacote `braces`, que é usado **apenas por ferramentas de desenvolvimento** (não vai para o aplicativo publicado). As dependências de produção não têm alertas (`npm audit --omit=dev` → 0 vulnerabilidades). Vamos reavaliar na Fase 8.

## Quando terminar

Me envie:

1. O resultado final do `npm run check` no seu computador.
2. O link do deploy na Vercel.

Com isso, a Fase 2 está concluída e começamos a **Fase 3 (autenticação e banco de dados)**. Nela você vai criar os dois projetos no Supabase (`dev` e `prod`).
