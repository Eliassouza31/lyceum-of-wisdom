# Fase 7 — Planos e pagamento (Stripe)

Status: **código pronto**, testado pelo CI num Supabase local.
Falta: aplicar a migração no Supabase da nuvem (eu faço, com o seu OK) e configurar o Stripe em **modo de teste** (passo a passo abaixo). Nenhum dinheiro de verdade é cobrado no modo de teste.

## Como funciona (em palavras simples)

1. Toda empresa nova ganha **14 dias grátis**, sem cartão. As empresas que já existem ganham 14 dias a partir de hoje.
2. Na página **Plans & billing** a empresa vê o plano atual, quantos e-mails já usou no mês e os 3 planos: **Basic US$ 19**, **Pro US$ 49** e **Business US$ 99** por mês.
3. Ao clicar em **Choose**, o site abre a página de pagamento do **Stripe** (o site nunca vê o número do cartão). Se ainda faltam dias de teste grátis, a primeira cobrança só acontece quando o teste acaba.
4. O Stripe avisa o site (webhook) quando o pagamento dá certo, falha, o plano muda ou é cancelado. **Só esse aviso muda o plano** da empresa: nada que venha do navegador consegue.
5. Em **Manage billing** (portal do Stripe) a empresa troca o cartão, muda de plano, vê as faturas e cancela.

### Quando os lembretes param

| Situação                                 | O que acontece                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Teste grátis acabou e não escolheu plano | Lembretes **pausados** (ficam na fila) até pagar                              |
| Pagamento falhou                         | Continua enviando por **7 dias**, com aviso amarelo; depois pausa             |
| Assinatura cancelada                     | Funciona até o fim do mês pago; depois pausa                                  |
| Chegou no limite de e-mails do mês       | Os próximos lembretes do mês são pulados com o motivo "monthly limit reached" |

Pausar **não apaga nada**. Quando a empresa paga, os lembretes que ainda estão no prazo saem normalmente.
Faltando 3 dias para o teste acabar, aparece um aviso em todas as páginas.

| Plano    | Preço/mês | E-mails por mês |
| -------- | --------- | --------------- |
| Teste    | grátis    | 1.000           |
| Basic    | US$ 19    | 1.000           |
| Pro      | US$ 49    | 5.000           |
| Business | US$ 99    | 20.000          |

Os limites ficam em `src/lib/billing/plans.ts` (e o de e-mails também no banco; um teste garante que os dois são iguais). Limites de clientes e de equipe por plano ficam para depois.

## O que foi construído

| Funcionalidade                                                                          | Onde está                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Tabela de assinaturas (1 por empresa), teste de 14 dias automático, registro de eventos | `supabase/migrations/20261024000000_billing.sql` |
| Envio só para empresas com acesso + limite mensal de e-mails                            | mesma migração (`claim_due_reminder_jobs`)       |
| Planos e regras (fonte única)                                                           | `src/lib/billing/plans.ts`                       |
| Checkout e portal do Stripe                                                             | `src/features/billing/actions.ts`                |
| Webhook do Stripe com verificação de assinatura                                         | `src/app/api/webhooks/stripe/route.ts`           |
| Página **Plans & billing**                                                              | `/billing`                                       |
| Aviso de teste acabando, pagamento falhou ou lembretes pausados                         | todas as páginas da área logada                  |

---

## O que você precisa fazer (≈ 20 minutos, depois do merge)

### 1. Aplicar a migração no Supabase da nuvem (eu faço)

Depois que você disser **"pode aplicar"**, eu aplico pelo conector. Ela cria a tabela de assinaturas e dá 14 dias de teste para a sua empresa. Não mexe em clientes nem agendamentos.

### 2. Criar a conta no Stripe

1. Abra https://dashboard.stripe.com/register e crie a conta (e-mail e senha).
2. Pode pular a parte de "ativar pagamentos" / dados bancários. Para testar não precisa.
3. Confira que no topo da tela aparece **Test mode** ou **Sandbox** (faixa laranja). Tudo abaixo é feito nesse modo.

### 3. Criar os 3 planos

1. No menu, clique em **Product catalog** → **+ Add product**.
2. Name: `Basic`. Em preço: **Recurring**, **Monthly**, valor `19.00`, moeda **USD**. Clique em **Add product**.
3. Repita para `Pro` (`49.00`) e `Business` (`99.00`).
4. Abra cada produto e copie o **Price ID** do preço (começa com `price_`). Guarde os 3.

### 4. Copiar a chave secreta

1. Clique em **Developers** → **API keys**.
2. Em **Secret key**, clique em **Reveal** e copie (começa com `sk_test_`).

> Essa chave é uma **senha**. Não mande por e-mail nem cole no chat; cole só na Vercel.

### 5. Criar o webhook

1. **Developers** → **Webhooks** → **+ Add endpoint** (ou **Add destination**).
2. Endpoint URL: `https://lyceum-of-wisdom-navy.vercel.app/api/webhooks/stripe`
3. Eventos: marque `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused` e `customer.subscription.resumed`. Salve.
4. Abra o webhook criado e copie o **Signing secret** (começa com `whsec_`).

### 6. Ligar o portal do cliente

1. Abra https://dashboard.stripe.com/test/settings/billing/portal
2. Ative **Cancel subscriptions** e **Switch plans** (em "Products", adicione Basic, Pro e Business).
3. Clique em **Save**.

### 7. Colar tudo na Vercel

1. Abra https://vercel.com, time **ELIASTEAM**, projeto **lyceum-of-wisdom** → **Settings** → **Environment Variables**.
2. Adicione, uma de cada vez (marque Production, Preview e Development):
   - `STRIPE_SECRET_KEY` = a chave `sk_test_...`
   - `STRIPE_WEBHOOK_SECRET` = o `whsec_...` do webhook
   - `STRIPE_PRICE_BASIC` = o `price_...` do Basic
   - `STRIPE_PRICE_PRO` = o `price_...` do Pro
   - `STRIPE_PRICE_BUSINESS` = o `price_...` do Business
3. Vá em **Deployments**, clique nos três pontinhos do último deploy → **Redeploy**.

### 8. Testar

1. Entre no site e clique em **Plans & billing**. Deve aparecer "Free trial: 14 days left".
2. Clique em **Choose Pro**. Na página do Stripe use o cartão de teste `4242 4242 4242 4242`, validade `12/34`, CVC `123`, qualquer nome e CEP.
3. Volte para o site. Em alguns segundos o plano vira **Pro** (atualize a página se precisar).
4. Clique em **Manage billing** para ver o portal: trocar de plano, cartão e cancelar.

Se o plano não mudar: no Stripe, abra **Developers** → **Webhooks** → seu endpoint e veja se os eventos estão com erro. Me mande um print.

## Antes de cobrar de verdade (Fase 9)

- Decidir como receber: pessoa/empresa no Brasil ou empresa nos EUA (consultar um contador).
- Ativar a conta do Stripe e repetir os passos 3 a 7 no modo real (as chaves mudam para `sk_live_`).

## Próxima fase

**Fase 8 — Segurança, testes e correções:** revisão de segurança, monitoramento de erros (Sentry), cabeçalhos de segurança e limite de tentativas.
