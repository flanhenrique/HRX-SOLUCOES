create or replace function private.route_hrx_outbound_email()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $route$
begin
  if new.channel <> 'email' then
    return new;
  end if;

  if new.template_key = 'quote_received_confirmation' then
    new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
      'from', 'contato@hrxsolutions.com.br',
      'replyTo', 'comercial@hrxsolutions.com.br'
    );
  elsif new.template_key in ('quote_proposal', 'quote_follow_up', 'contract_ready') then
    new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
      'from', 'comercial@hrxsolutions.com.br',
      'replyTo', 'comercial@hrxsolutions.com.br'
    );
  end if;

  return new;
end;
$route$;

drop trigger if exists hrx_route_outbound_email on public.outbound_messages;
create trigger hrx_route_outbound_email
before insert or update of template_key, channel, payload on public.outbound_messages
for each row execute function private.route_hrx_outbound_email();

create or replace function private.queue_hrx_new_quote_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $queue$
begin
  insert into public.outbound_messages (request_id, channel, template_key, status, payload)
  values (
    new.id,
    'email',
    'new_quote_internal',
    'pending',
    jsonb_build_object(
      'to', 'contato@hrxsolutions.com.br',
      'replyTo', new.email,
      'name', new.name,
      'email', new.email,
      'phone', new.phone,
      'company', new.company,
      'protocol', new.protocol
    )
  );
  return new;
end;
$queue$;

drop trigger if exists hrx_queue_new_quote_notification on public.quote_requests;
create trigger hrx_queue_new_quote_notification
after insert on public.quote_requests
for each row execute function private.queue_hrx_new_quote_notification();

update public.outbound_messages
set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
  'from', 'contato@hrxsolutions.com.br',
  'replyTo', 'comercial@hrxsolutions.com.br'
)
where channel = 'email' and template_key = 'quote_received_confirmation';
