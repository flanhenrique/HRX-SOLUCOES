alter table public.quote_drafts
  add column if not exists fiscal_review_confirmed boolean not null default false;

alter table public.quote_drafts
  add column if not exists fiscal_review_confirmed_by uuid references auth.users(id);

alter table public.quote_drafts
  add column if not exists fiscal_review_confirmed_at timestamptz;
