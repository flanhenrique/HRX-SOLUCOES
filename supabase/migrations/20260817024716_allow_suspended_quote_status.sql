alter table public.quote_drafts drop constraint if exists quote_drafts_status_check;
alter table public.quote_drafts add constraint quote_drafts_status_check
  check (status = any (array['awaiting_review'::text,'needs_scope'::text,'approved'::text,'rejected'::text,'suspended'::text]));

alter table public.quote_requests drop constraint if exists quote_requests_status_check;
alter table public.quote_requests add constraint quote_requests_status_check
  check (status = any (array['received'::text,'interpreting'::text,'awaiting_review'::text,'needs_scope'::text,'approved'::text,'contacted'::text,'proposal_sent'::text,'won'::text,'lost'::text,'suspended'::text]));
