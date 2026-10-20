# Fase 4 — Dashboard e clientes

Status: **código pronto e testado** num Supabase local (o mesmo software do Supabase na nuvem, rodando em Docker).
Falta apenas **aplicar a nova migração no seu Supabase da nuvem** depois do merge (passo a passo abaixo).

## O que foi construído

| Funcionalidade                                                                                      | Onde está                                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Tabelas `clients` e `consent_events` + segurança por linha (RLS)                                    | `supabase/migrations/20261021000000_clients.sql` |
| Histórico de consentimento gravado **automaticamente pelo banco** (trigger), sem edição ou exclusão | mesma migração                                   |
| Lista de clientes com busca (nome, e-mail, telefone) e paginação de 25 em 25                        | `/clients`                                       |
| Cadastro de cliente                                                                                 | `/clients/new`                                   |
| Detalhes, edição, histórico de consentimento e remoção                                              | `/clients/[id]`                                  |
| Telefone convertido para o formato internacional (E.164), ex.: `(555) 234-5678` → `+15552345678`    | `src/lib/phone.ts`                               |
| Datas mostradas no fuso da empresa (com horário de verão)                                           | `src/lib/time.ts`                                |
| Dashboard com número de clientes e de clientes que aceitam lembretes                                | `/dashboard`                                     |
| Item "Clients" liberado no menu lateral                                                             | `src/components/layout/app-nav.tsx`              |

### Decisões importantes

- **Consentimento é prova legal.** Lembrete por e-mail só vai para quem aceitou. Cada vez que a caixa "agreed to receive reminders" muda, o banco grava quem mudou e quando. Ninguém consegue apagar ou alterar esse histórico pelo app.
- **Sem e-mail, sem consentimento.** O banco recusa marcar "aceita lembretes" num cliente sem e-mail.
- **Remover não apaga.** "Remove client" esconde o cliente (_soft delete_), mas mantém o histórico. O e-mail fica livre para cadastrar de novo.
- **E-mail único por empresa.** Duas empresas podem ter o mesmo cliente; a mesma empresa não pode cadastrar o mesmo e-mail duas vezes.
- **SMS ainda bloqueado.** O consentimento de SMS existe na tabela, mas o app não consegue ligá-lo até a fase de SMS (regras TCPA).
- **Aviso nas observações:** não guardar dados de saúde.

## Testes executados (resultados reais)

| Suíte                                                                                                     | Comando                    | Resultado       |
| --------------------------------------------------------------------------------------------------------- | -------------------------- | --------------- |
| Unitários (validação do formulário, telefone, busca segura, datas e fusos)                                | `npm test`                 | **64 passaram** |
| Integração — clientes, consentimento e isolamento entre empresas (RLS)                                    | `npm run test:integration` | **25 passaram** |
| Ponta a ponta no navegador (cadastro → erros → edição → histórico → busca → remoção → dashboard; celular) | `npm run test:e2e`         | **17 passaram** |
| Lint do banco (Supabase)                                                                                  | `npm run db:lint`          | sem problemas   |
| Build de produção                                                                                         | `npm run build`            | ok              |

**Prova de que os testes de RLS funcionam:** desativei temporariamente a RLS da tabela `clients` e rodei a suíte. 3 testes de isolamento falharam, como esperado. Reativei e todos voltaram a passar.

---

## O que você precisa fazer (≈ 5 minutos, depois do merge)

### 1. Aplicar a nova migração no Supabase da nuvem

Isso cria as tabelas novas. Não mexe nas contas e empresas que já existem.

**Opção A — eu faço por você:** conecte o conector do Supabase em claude.ai (**Settings → Connectors → Supabase**) e me avise.

**Opção B — você faz pelo PowerShell**, dentro da pasta do projeto (se já fez o `link` na fase 3, pule as duas primeiras linhas):

```powershell
git pull
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

O `db push` mostra a migração `20261021000000_clients.sql` e pede confirmação. Responda `Y`.

> Faça isso **logo depois do merge**: a Vercel publica o código novo sozinha, e a página de clientes só funciona quando as tabelas existem.

### 2. Testar

1. Abra o endereço da Vercel e entre na sua conta.
2. No dashboard, clique em **Add your first client**.
3. Cadastre um cliente com seu próprio e-mail e marque a caixa de consentimento.
4. Na página do cliente, confira o **Consent history**. Desmarque a caixa, salve e veja o novo registro.
5. Volte ao dashboard: os números devem ter mudado.

## Próxima fase

**Fase 5 — Agendamentos:** cadastro de agendamentos ligados aos clientes, calendário (dia/semana/mês) e tratamento de fuso horário.
