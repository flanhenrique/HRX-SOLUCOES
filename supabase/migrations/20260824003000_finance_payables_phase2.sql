-- Financeiro HRX - Fase 2: contas a pagar manuais sobre o ledger oficial.
-- Mantém o mesmo financial_entries/financial_settlements da Fase 1 e apenas
-- adiciona o favorecido/fornecedor estruturado e índice operacional de vencimentos.

alter table public.financial_entries
  add column if not exists counterparty_name text;

alter table public.financial_entries drop constraint if exists financial_entries_counterparty_name_length;
alter table public.financial_entries add constraint financial_entries_counterparty_name_length
  check (counterparty_name is null or char_length(trim(counterparty_name)) between 2 and 160);

create index if not exists financial_entries_open_payables_due_idx
  on public.financial_entries(due_date, status)
  where entry_type = 'payable' and status in ('open','partial','overdue');

create index if not exists financial_entries_counterparty_idx
  on public.financial_entries(lower(counterparty_name))
  where counterparty_name is not null;

comment on column public.financial_entries.counterparty_name is
  'Favorecido, fornecedor ou contraparte do lançamento financeiro manual.';
