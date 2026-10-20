# Fase 6 — Lembretes por e-mail

Status: **código pronto e testado** num Supabase local.
Falta: aplicar a migração no Supabase da nuvem, criar a conta no Resend e colar 2 chaves na Vercel (passo a passo abaixo).

## Como funciona (em palavras simples)

1. Você define **quando** avisar (ex.: "1 dia antes"). Toda empresa já começa com "1 dia antes".
2. Quando um agendamento é criado, o banco cria sozinho um **lembrete na fila** para cada regra. Se você remarcar, o horário do lembrete muda junto. Se cancelar ou excluir, o lembrete é cancelado.
3. **A cada minuto**, o Supabase chama o endereço `/api/cron/dispatch` do seu site. O site pega os lembretes que chegaram na hora e envia pelo **Resend**.
4. Se o envio falhar por um problema passageiro, ele tenta de novo depois de 1 min, 5 min, 30 min e 2 h (5 tentativas no total).
5. O **Resend** avisa o site quando o e-mail foi entregue, voltou (endereço não existe) ou foi marcado como spam. Endereços que voltaram ou reclamaram não recebem mais nada.
6. Todo e-mail tem no rodapé o **endereço da empresa** e um link **"Unsubscribe"** (exigência da lei CAN-SPAM dos EUA).

## O que foi construído

| Funcionalidade                                                                                        | Onde está                                          |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Tabelas de regras, modelo de mensagem, fila, histórico, bloqueios e contagem de uso, com RLS          | `supabase/migrations/20261023000000_reminders.sql` |
| Fila sincronizada com agendamentos e regras (triggers no banco)                                       | mesma migração                                     |
| Agendador `pg_cron` a cada minuto + segredo gerado e guardado no **Vault** do Supabase                | mesma migração                                     |
| Envio: pega até 20 lembretes por vez sem duplicar (`FOR UPDATE SKIP LOCKED`), envia, registra         | `src/features/reminders/dispatcher.ts`             |
| Rota chamada pelo agendador (protegida pelo segredo)                                                  | `src/app/api/cron/dispatch/route.ts`               |
| Webhook do Resend com verificação de assinatura                                                       | `src/app/api/webhooks/resend/route.ts`             |
| Página **Reminders**: horários (até 5), mensagem com variáveis e prévia, e-mail de resposta, endereço | `/reminders`                                       |
| Página **Notification history**: cada lembrete, status (na fila, enviado, entregue...) e motivo       | `/notifications`                                   |
| Lembretes de cada agendamento na página do agendamento                                                | `/appointments/[id]`                               |
| Descadastro: página com botão + "one-click" do Gmail; fica no histórico de consentimento do cliente   | `/unsubscribe`, `/api/unsubscribe`                 |
| Passo "Set up email reminders" no dashboard                                                           | `/dashboard`                                       |

### Decisões importantes

- **Só envia para quem aceitou.** Cliente sem e-mail ou sem consentimento: o lembrete fica como "Not sent" com o motivo.
- **Sem endereço da empresa, não envia.** A lei exige o endereço no rodapé. A página Reminders mostra um aviso vermelho até você preencher.
- **Nunca envia atrasado.** Se você marca um horário para daqui a 2 horas e a regra é "1 dia antes", esse lembrete é pulado ("booked after this reminder's time").
- **Sem duplicados.** O banco impede dois lembretes iguais, e cada envio leva uma "chave de idempotência": mesmo que o site seja chamado duas vezes, o Resend só envia uma.
- **Segredo do agendador não sai do banco.** Ele é criado dentro do Supabase pela migração, e o site o lê de lá. Por isso você **não** precisa criar nem copiar esse segredo.
- **Descadastro com botão.** O link do e-mail abre uma página com o botão "Unsubscribe" (programas de e-mail que abrem links sozinhos não descadastram ninguém sem querer).
- **Mudanças pela equipe.** Só o dono ou um admin muda horários, mensagem e endereço. Funcionários (staff) só veem.
- **Cota e plano pago ficam para a fase 7.** O sistema já conta quantos e-mails saem por mês (`usage_counters`), mas ainda não bloqueia.

## Testes executados (resultados reais)

| Suíte                                                                                                      | Comando                    | Resultado        |
| ---------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------- |
| Unitários (modelos, variáveis, HTML escapado, horários, Resend, assinatura do webhook, segredo, status)    | `npm test`                 | **123 passaram** |
| Integração: fila acompanha agendamentos e regras, envio sem duplicar, reenvio, bloqueios, descadastro, RLS | `npm run test:integration` | **55 passaram**  |
| Ponta a ponta no navegador: configurar, agendar, enviar (Resend falso), webhook "entregue", descadastrar   | `npm run test:e2e`         | **25 passaram**  |
| Lint do banco (Supabase)                                                                                   | `npm run db:lint`          | sem problemas    |
| Build de produção                                                                                          | `npm run build`            | ok               |

**Prova de que os testes de RLS funcionam:** desativei a RLS da tabela `reminder_jobs` e rodei a suíte. O teste de isolamento falhou, como esperado. Reativei e tudo voltou a passar.

---

## O que você precisa fazer (≈ 15 minutos, depois do merge)

### 1. Aplicar a migração no Supabase da nuvem (eu faço)

Depois que você disser **"pode aplicar"**, eu aplico pelo conector e ligo o agendador apontando para
`https://lyceum-of-wisdom-navy.vercel.app/api/cron/dispatch`. Não mexe nos seus clientes e agendamentos.
Os agendamentos futuros que já existem ganham o lembrete "1 dia antes" automaticamente.

### 2. Criar a conta no Resend e uma chave

1. Abra https://resend.com e clique em **Sign up** (pode entrar com a conta do GitHub ou Google).
2. No menu da esquerda, clique em **API Keys** → **Create API Key**.
3. Nome: `lyceum-vercel`. Permission: **Sending access**. Clique em **Add**.
4. Copie a chave (começa com `re_`). Ela só aparece uma vez.

### 3. Copiar a chave secreta do Supabase

1. Abra https://supabase.com/dashboard e entre no projeto **agendamentos-lembretes**.
2. Clique na engrenagem **Project Settings** → **API Keys**.
3. Na parte **Secret keys**, clique em **Reveal** (ou **Create new secret key** se não houver nenhuma) e copie (começa com `sb_secret_`).

> Essas duas chaves são **senhas**. Não mande por e-mail nem cole no chat; cole só na Vercel.

### 4. Colar as chaves na Vercel

1. Abra https://vercel.com, time **ELIASTEAM**, projeto **lyceum-of-wisdom**.
2. **Settings** → **Environment Variables**.
3. Adicione, uma de cada vez (marque Production, Preview e Development):
   - `RESEND_API_KEY` = a chave do Resend
   - `SUPABASE_SECRET_KEY` = a chave secreta do Supabase
   - Confira se `NEXT_PUBLIC_APP_URL` = `https://lyceum-of-wisdom-navy.vercel.app` já está lá.
4. Vá em **Deployments**, clique nos três pontinhos do último deploy → **Redeploy**.

> **Sem domínio próprio** (por enquanto): não crie `RESEND_FROM_EMAIL`. O site usa o endereço de teste do Resend, que **só entrega para o e-mail com que você criou a conta no Resend**. Serve para testar.
> **Com domínio** (antes de ter clientes reais): no Resend, **Domains** → **Add Domain**, siga as instruções de DNS, e depois crie `RESEND_FROM_EMAIL` = `reminders@seudominio.com` na Vercel.

### 5. (Opcional agora) Avisos de entrega do Resend

1. No Resend: **Webhooks** → **Add Webhook**.
2. Endpoint URL: `https://lyceum-of-wisdom-navy.vercel.app/api/webhooks/resend`
3. Eventos: marque `email.delivered`, `email.bounced` e `email.complained`. Salve.
4. Abra o webhook criado e copie o **Signing Secret** (começa com `whsec_`).
5. Na Vercel, adicione `RESEND_WEBHOOK_SECRET` com esse valor e faça **Redeploy** de novo.

Sem esse passo os lembretes funcionam, só não aparece "Delivered" no histórico.

### 6. Testar de verdade

1. Entre no site e clique em **Reminders**. Preencha **Business mailing address** e salve.
2. Em "When to send", adicione **15 minutes before**.
3. Em **Clients**, crie um cliente com **o seu e-mail do Resend** e marque o consentimento.
4. Marque um agendamento para esse cliente **daqui a uns 20 minutos**.
5. Em uns 5 minutos chega o e-mail. Veja em **Notification history**: "Sent" (ou "Delivered", se fez o passo 5).
6. Clique em **Unsubscribe** no rodapé do e-mail e confirme. Na página do cliente, o histórico mostra "Unsubscribe link".

## Próxima fase

**Fase 7 — Planos e pagamento (Stripe):** período de teste, planos Basic/Pro/Business, cota mensal de e-mails e pausa dos lembretes quando a assinatura vencer.
