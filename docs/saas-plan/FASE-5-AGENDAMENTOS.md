# Fase 5 — Agendamentos

Status: **código pronto e testado** num Supabase local (o mesmo software do Supabase na nuvem, rodando em Docker).
Falta apenas **aplicar a nova migração no seu Supabase da nuvem** depois do merge (passo a passo abaixo).

## O que foi construído

| Funcionalidade                                                                         | Onde está                                             |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Tabela `appointments` + segurança por linha (RLS)                                      | `supabase/migrations/20261022000000_appointments.sql` |
| Calendário com visão de **dia, semana e mês**, botões "anterior / hoje / próximo"      | `/calendar`                                           |
| Lista de agendamentos **futuros** e **passados**, de 25 em 25                          | `/appointments`                                       |
| Novo agendamento: cliente, serviço, data, hora de início, duração, local e observações | `/appointments/new`                                   |
| Detalhes, edição, mudança de status (cancelar, concluído, faltou, reativar) e exclusão | `/appointments/[id]`                                  |
| Conversão entre o **fuso da empresa** e UTC, com horário de verão dos EUA              | `src/lib/time.ts`                                     |
| Página do cliente mostra os agendamentos dele e tem o botão "Book appointment"         | `/clients/[id]`                                       |
| Dashboard com "agendamentos hoje", "próximos agendamentos" e a lista dos 5 próximos    | `/dashboard`                                          |
| Itens "Calendar" e "Appointments" liberados no menu lateral                            | `src/components/layout/app-nav.tsx`                   |

### Decisões importantes

- **Horário sempre no fuso da empresa.** O formulário mostra "Times are in Central Time (Chicago)" (ou o fuso escolhido no cadastro). O banco guarda em UTC.
- **Horário de verão.** No dia em que o relógio pula de 2h para 3h (2º domingo de março), horários como 2h30 **não existem** e o formulário recusa com uma mensagem clara. No dia em que o relógio volta (1º domingo de novembro), 1h30 acontece duas vezes; usamos a primeira.
- **A duração é em minutos reais.** Um agendamento de 1 hora dura 60 minutos mesmo na noite da troca de horário.
- **Cliente removido.** Não dá para marcar horário para um cliente removido. Quando você remove um cliente, os agendamentos **futuros** dele são cancelados automaticamente (assim, na fase 6, nenhum lembrete vai para ele). Os passados ficam no histórico.
- **Cancelar x excluir.** "Cancel" mantém o registro (útil para relatórios). "Delete" é para quem marcou por engano; o agendamento some do app, mas continua no banco.
- **Ninguém escolhe o status inicial nem o autor.** Todo agendamento nasce como `scheduled`, e o banco grava quem criou.
- **Horários sobrepostos são permitidos.** Uma empresa pode ter mais de um profissional atendendo ao mesmo tempo.

## Testes executados (resultados reais)

| Suíte                                                                                                        | Comando                    | Resultado        |
| ------------------------------------------------------------------------------------------------------------ | -------------------------- | ---------------- |
| Unitários (fusos, horário de verão, formulário, calendário dia/semana/mês, durações, status)                 | `npm test`                 | **101 passaram** |
| Integração — agendamentos, cliente removido e isolamento entre empresas (RLS)                                | `npm run test:integration` | **36 passaram**  |
| Ponta a ponta no navegador (marcar → calendário → remarcar → horário de verão → cancelar → excluir; celular) | `npm run test:e2e`         | **21 passaram**  |
| Lint do banco (Supabase)                                                                                     | `npm run db:lint`          | sem problemas    |
| Build de produção                                                                                            | `npm run build`            | ok               |

**Prova de que os testes de RLS funcionam:** desativei temporariamente a RLS da tabela `appointments` e rodei a suíte. 3 testes de isolamento falharam, como esperado. Reativei e todos voltaram a passar.

---

## O que você precisa fazer (≈ 5 minutos, depois do merge)

### 1. Aplicar a nova migração no Supabase da nuvem

Isso cria a tabela de agendamentos. Não mexe nos clientes e empresas que já existem.

**Opção A (recomendada) — eu faço por você** pelo conector do Supabase, depois que você disser "pode aplicar".

**Opção B — você faz pelo PowerShell.** Atenção: as migrações das fases 3 e 4 foram aplicadas pelo conector com outros números de versão, então o `db push` tentaria aplicá-las de novo. Por isso, prefira a opção A.

### 2. Testar (quando o site estiver publicado, ou com `npm run dev` no seu computador)

1. Entre na sua conta e clique em **Calendar** no menu.
2. Clique em **New appointment**, escolha um cliente, um serviço, a data e a hora. Salve.
3. Veja o agendamento nas visões **Week** e **Month**.
4. Abra o agendamento, mude a hora e salve. Depois clique em **Cancel appointment**.
5. Volte ao dashboard: os números de agendamentos devem aparecer.

## Próxima fase

**Fase 6 — Lembretes por e-mail:** domínio no Resend, regras ("24h antes"), templates, envio automático, reenvio, histórico e descadastro. Essa fase **precisa do site publicado** (o agendador do Supabase chama uma rota do site a cada minuto).
