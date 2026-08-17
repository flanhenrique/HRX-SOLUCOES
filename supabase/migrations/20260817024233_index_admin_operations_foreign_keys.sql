create index if not exists clients_created_by_idx on public.clients(created_by) where created_by is not null;
create index if not exists quote_drafts_suspended_by_idx on public.quote_drafts(suspended_by) where suspended_by is not null;
create index if not exists quote_suspensions_draft_id_idx on public.quote_suspensions(draft_id) where draft_id is not null;
create index if not exists quote_suspensions_suspended_by_idx on public.quote_suspensions(suspended_by) where suspended_by is not null;
create index if not exists quote_suspensions_resumed_by_idx on public.quote_suspensions(resumed_by) where resumed_by is not null;
