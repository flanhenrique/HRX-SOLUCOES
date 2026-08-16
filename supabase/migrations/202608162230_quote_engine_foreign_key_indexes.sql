create index if not exists outbound_messages_request_id_idx on public.outbound_messages(request_id);
create index if not exists quote_audit_actor_user_idx on public.quote_audit_log(actor_user_id);
create index if not exists quote_drafts_approved_by_idx on public.quote_drafts(approved_by);
create index if not exists quote_drafts_fiscal_review_by_idx on public.quote_drafts(fiscal_review_confirmed_by);
create index if not exists quote_items_draft_id_idx on public.quote_items(draft_id);
