create schema mezza_private;
revoke all on schema mezza_private from public,anon,authenticated;
grant usage on schema mezza_private to service_role;
alter type public.audit_action add value 'bill_workflow';
alter table public.restaurants add column guest_ordering_paused boolean not null default false;
-- Opt-in workflow. Browser roles cannot read workflow credentials or execute its RPCs.
alter table public.tabs add column staff_managed boolean not null default false;
alter table public.tabs add column bill_revision integer not null default 0;
alter table public.tabs add column bill_state_bps integer;
alter table public.tabs add column bill_municipal_bps integer;
-- Compound foreign keys enforce visit ownership as well as restaurant ownership.
alter table public.tab_participants add unique(restaurant_id,tab_id,id);
alter table public.orders add unique(restaurant_id,tab_id,id);
alter table public.payments add unique(restaurant_id,tab_id,id);
create table mezza_private.visit_sessions (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null, tab_id uuid not null,
 participant_id uuid not null, secret_hash text not null unique check(length(secret_hash)=64),
 receipt_hash text not null check(length(receipt_hash)=64),
 expires_at timestamptz not null, revoked_at timestamptz,
 draft_version integer not null default 0, draft jsonb not null default '[]',
 foreign key(restaurant_id,tab_id) references public.tabs(restaurant_id,id),
 foreign key(restaurant_id,tab_id,participant_id) references public.tab_participants(restaurant_id,tab_id,id)
);
create table mezza_private.visit_requests (
 id uuid primary key, restaurant_id uuid not null, tab_id uuid not null, participant_id uuid not null,
 status text not null default 'pending' check(status in ('pending','accepted','rejected','cancel_requested','cancelled')),
 lines jsonb not null, locale public.app_locale not null, order_id uuid, reason text,
 created_at timestamptz not null default now(),
 foreign key(restaurant_id,tab_id) references public.tabs(restaurant_id,id),
 foreign key(restaurant_id,tab_id,participant_id) references public.tab_participants(restaurant_id,tab_id,id),
 foreign key(restaurant_id,tab_id,order_id) references public.orders(restaurant_id,tab_id,id)
);
create table mezza_private.bill_portions (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null, tab_id uuid not null,
 participant_id uuid not null, label text not null, subtotal_cents integer not null check(subtotal_cents>=0),
 state_cents integer not null check(state_cents>=0), municipal_cents integer not null check(municipal_cents>=0),
 lines jsonb not null, status text not null default 'unpaid' check(status in ('unpaid','paid','written_off')),
 settled_at timestamptz, payment_id uuid, reason text, actor_id uuid references auth.users(id),
 foreign key(restaurant_id,tab_id) references public.tabs(restaurant_id,id),
 foreign key(restaurant_id,tab_id,participant_id) references public.tab_participants(restaurant_id,tab_id,id),
 foreign key(restaurant_id,tab_id,payment_id) references public.payments(restaurant_id,tab_id,id), unique(tab_id,participant_id)
);
create table mezza_private.visit_receipts (
 payment_id uuid primary key references public.payments(id), tab_id uuid not null references public.tabs(id),
 payer_id uuid not null references public.tab_participants(id), secret_hash text not null check(length(secret_hash)=64),
 snapshot jsonb not null, expires_at timestamptz
);
create table mezza_private.visit_recoveries (
 ticket_hash text primary key check(length(ticket_hash)=64), tab_id uuid not null references public.tabs(id),
 participant_id uuid not null references public.tab_participants(id), expires_at timestamptz not null
);
create table mezza_private.visit_limits (key text primary key, started_at timestamptz not null, hits integer not null);
create index visit_sessions_tab on mezza_private.visit_sessions(tab_id);
create index visit_requests_tab on mezza_private.visit_requests(tab_id,status);
create index bill_portions_tab on mezza_private.bill_portions(tab_id);
DO $$ declare t text; begin
 foreach t in array array['visit_sessions','visit_requests','bill_portions','visit_receipts','visit_limits','visit_recoveries'] loop
 execute format('alter table mezza_private.%I enable row level security',t);
 execute format('revoke all on mezza_private.%I from public,anon,authenticated',t);
 execute format('grant all on mezza_private.%I to service_role',t);
 end loop;
end $$;

create function public.visit_rate_limit(p_key text,p_max integer,p_seconds integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer; begin
 if length(p_key)>200 or p_max<1 or p_seconds<1 then raise exception 'invalid_limit'; end if;
 insert into mezza_private.visit_limits(key,started_at,hits) values(p_key,now(),1)
 on conflict(key) do update set
 hits=case when mezza_private.visit_limits.started_at<=now()-make_interval(secs=>p_seconds) then 1 else mezza_private.visit_limits.hits+1 end,
 started_at=case when mezza_private.visit_limits.started_at<=now()-make_interval(secs=>p_seconds) then now() else mezza_private.visit_limits.started_at end
 returning hits into n;
 -- Best-effort bounded cleanup; counter failure never authorizes a write.
 delete from mezza_private.visit_limits where key in (select key from mezza_private.visit_limits where started_at<now()-interval '1 day' limit 100 for update skip locked);
 return n<=p_max;
end $$;

create function public.visit_snapshot(p_tab uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object('id',t.id,'tableId',t.table_id,'status',t.status,'revision',t.bill_revision,'orderingPaused',(select guest_ordering_paused from public.restaurants where id=t.restaurant_id),
'participants',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,
 'removed',exists(select 1 from mezza_private.visit_sessions z where z.participant_id=p.id) and not exists(select 1 from mezza_private.visit_sessions z where z.participant_id=p.id and z.revoked_at is null and z.expires_at>now()),
 'draft',jsonb_build_object('version',coalesce(s.draft_version,0),'lines',coalesce(s.draft,'[]'::jsonb))) order by p.created_at)
 from public.tab_participants p left join lateral(select draft,draft_version from mezza_private.visit_sessions x where x.participant_id=p.id and x.revoked_at is null order by x.expires_at desc limit 1)s on true where p.tab_id=t.id),'[]'::jsonb),
'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'participantId',r.participant_id,'name',p.display_name,'status',r.status,'lines',r.lines,'createdAt',r.created_at) order by r.created_at) from mezza_private.visit_requests r join public.tab_participants p on p.id=r.participant_id where r.tab_id=t.id),'[]'::jsonb),
'lines',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'qty',i.qty,'unitCents',i.unit_price_cents,'name',i.name_snapshot_es,'participantId',i.participant_id) order by i.created_at,i.id) from public.order_items i join public.orders o on o.id=i.order_id where o.tab_id=t.id and o.status<>'void' and i.voided_at is null),'[]'::jsonb),
'tax',jsonb_build_object('state',floor((coalesce(b.subtotal,0)*t.bill_state_bps+5000)/10000.0),'municipal',floor((coalesce(b.subtotal,0)*t.bill_municipal_bps+5000)/10000.0)),
'portions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'participantId',p.participant_id,'label',p.label,'subtotalCents',p.subtotal_cents,'stateCents',p.state_cents,'municipalCents',p.municipal_cents,'lines',p.lines,'status',p.status,'paymentId',p.payment_id,'payerName',(select display_name from public.tab_participants where id=(select participant_id from public.payments where id=p.payment_id))) order by p.id) from mezza_private.bill_portions p where p.tab_id=t.id),'[]'::jsonb))
from public.tabs t left join lateral(select sum(i.qty::bigint*i.unit_price_cents) subtotal from public.order_items i join public.orders o on o.id=i.order_id where o.tab_id=t.id and o.status<>'void' and i.voided_at is null)b on true where t.id=p_tab;
$$;

create function public.visit_workflow(p_op text,p_table uuid default null,p_tab uuid default null,p_actor uuid default null,p_secret_hash text default null,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.tabs%rowtype; s mezza_private.visit_sessions%rowtype; r mezza_private.visit_requests%rowtype;
 role_name public.member_role; pid uuid; result jsonb; snap jsonb; v jsonb; line jsonb; pr jsonb;
 subtotal bigint; st bigint; mu bigint; n integer; covered integer; pay uuid; wanted uuid[]; total bigint;
begin
 if p_op='open' then
  -- Match place_order's restaurant->table/tab lock ordering.
  perform 1 from public.restaurants where id=(select restaurant_id from public.dining_tables where id=p_table) for update;
  perform 1 from public.dining_tables where id=p_table for update;
  select m.role into role_name from public.memberships m join public.dining_tables d on d.restaurant_id=m.restaurant_id where d.id=p_table and m.user_id=p_actor and m.active and m.role in ('owner','manager','server');
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if exists(select 1 from public.tabs where table_id=p_table and status<>'closed') then raise exception 'visit_already_open'; end if;
  insert into public.tabs(restaurant_id,table_id,staff_managed,bill_state_bps,bill_municipal_bps)
  select d.restaurant_id,d.id,true,rest.ivu_state_bps,rest.ivu_municipal_bps from public.dining_tables d join public.restaurants rest on rest.id=d.restaurant_id where d.id=p_table returning * into t;
  return public.visit_snapshot(t.id);
 end if;
 if p_tab is null and p_op='join' then select id into p_tab from public.tabs where table_id=p_table and status<>'closed' and staff_managed; end if;
 -- Serialize all mutations and accepted order number creation consistently.
 perform 1 from public.restaurants where id=(select restaurant_id from public.tabs where id=p_tab) for update;
 select * into t from public.tabs where id=p_tab for update;
 if not found or not t.staff_managed or (p_table is not null and t.table_id<>p_table) then raise exception 'visit_not_open'; end if;
 if p_actor is not null then
  select role into role_name from public.memberships where restaurant_id=t.restaurant_id and user_id=p_actor and active and role in ('owner','manager','server');
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
 elsif p_op<>'join' then
  select * into s from mezza_private.visit_sessions where tab_id=t.id and secret_hash=p_secret_hash and revoked_at is null and expires_at>now();
  if not found or t.status='closed' then raise exception 'session_expired' using errcode='42501'; end if;
 end if;
 if p_op='join' then
  if t.status<>'open' or length(coalesce(p_secret_hash,''))<>64 or length(btrim(coalesce(p_data->>'name',''))) not between 1 and 32 then raise exception 'invalid_join'; end if;
  select * into s from mezza_private.visit_sessions where secret_hash=p_secret_hash and tab_id=t.id and revoked_at is null and expires_at>now();
  if found then return jsonb_build_object('participantId',s.participant_id,'expiresAt',s.expires_at,'visit',public.visit_snapshot(t.id)); end if;
  if (select count(*) from public.tab_participants where tab_id=t.id)>=40 then raise exception 'participant_limit'; end if;
  insert into public.tab_participants(restaurant_id,tab_id,display_name) values(t.restaurant_id,t.id,btrim(p_data->>'name')) returning id into pid;
  insert into mezza_private.visit_sessions(restaurant_id,tab_id,participant_id,secret_hash,receipt_hash,expires_at) values(t.restaurant_id,t.id,pid,p_secret_hash,p_data->>'receiptHash',now()+interval '4 hours') returning * into s;
  return jsonb_build_object('participantId',pid,'expiresAt',s.expires_at,'visit',public.visit_snapshot(t.id));
 elsif p_op='snapshot' then
  if p_actor is not null then return public.visit_snapshot(t.id); end if;
  return jsonb_build_object('participantId',s.participant_id,'expiresAt',s.expires_at,'visit',public.visit_snapshot(t.id));
 elsif p_op='draft' then
  if p_actor is not null or t.status<>'open' or jsonb_typeof(p_data->'lines')<>'array' or jsonb_array_length(p_data->'lines')>50 or octet_length(p_data::text)>64000 then raise exception 'invalid_draft'; end if;
  if s.draft_version<>(p_data->>'version')::integer then raise exception 'stale_cart'; end if;
  update mezza_private.visit_sessions set draft=p_data->'lines',draft_version=draft_version+1 where id=s.id;
 elsif p_op='submit' then
  if p_actor is not null then raise exception 'forbidden'; end if;
  select * into r from mezza_private.visit_requests where id=(p_data->>'id')::uuid;
  if found then
   if r.tab_id<>t.id or r.participant_id<>s.participant_id then raise exception 'forbidden' using errcode='42501'; end if;
   return jsonb_build_object('requestId',r.id,'status',r.status);
  end if;
  if t.status<>'open' then raise exception 'bill_locked'; end if;
  if (select guest_ordering_paused from public.restaurants where id=t.restaurant_id) then raise exception 'ordering_paused'; end if;
  if s.draft_version<>(p_data->>'version')::integer then raise exception 'stale_cart'; end if;
  if jsonb_array_length(s.draft) not between 1 and 50 then raise exception 'empty_cart'; end if;
  if coalesce((select sum(i.qty) from public.order_items i join public.orders o on o.id=i.order_id where o.tab_id=t.id and i.voided_at is null and o.status<>'void'),0)+coalesce((select sum((x->>'qty')::bigint) from mezza_private.visit_requests q cross join lateral jsonb_array_elements(q.lines)x where q.tab_id=t.id and q.status='pending'),0)+(select sum((x->>'qty')::bigint) from jsonb_array_elements(s.draft)x)>500 then raise exception 'cart_limit'; end if;
  if (select count(*) from mezza_private.visit_requests where tab_id=t.id and status in ('pending','cancel_requested'))>=20 then raise exception 'request_limit'; end if;
  insert into mezza_private.visit_requests(id,restaurant_id,tab_id,participant_id,lines,locale) values((p_data->>'id')::uuid,t.restaurant_id,t.id,s.participant_id,s.draft,coalesce(p_data->>'locale','es')::public.app_locale) returning * into r;
  update mezza_private.visit_sessions set draft='[]',draft_version=draft_version+1 where id=s.id;
  return jsonb_build_object('requestId',r.id,'status',r.status);
 elsif p_op='request_cancel' then
  if p_actor is not null or t.status<>'open' then raise exception 'bill_locked'; end if;
  update mezza_private.visit_requests set status=case when status='pending' then 'cancelled' else 'cancel_requested' end where id=(p_data->>'id')::uuid and tab_id=t.id and participant_id=s.participant_id and status in ('pending','accepted');
 elsif p_op in ('accept','reject','cancel') then
  if p_actor is null then raise exception 'forbidden' using errcode='42501'; end if;
  select * into r from mezza_private.visit_requests where id=(p_data->>'id')::uuid and tab_id=t.id for update;
  if not found then raise exception 'request_not_found'; end if;
  if p_op='accept' then
   if r.status='accepted' then return public.visit_snapshot(t.id); end if;
   if r.status<>'pending' or t.status<>'open' then raise exception 'bill_locked'; end if;
   perform set_config('mezza.visit_workflow',t.id::text,true);
   result=public.place_order(t.restaurant_id,t.table_id,r.id::text,'qr',(select jsonb_agg(jsonb_build_object('itemId',x->>'itemId','qty',x->'qty','modifierOptionIds',x->'optionIds','note',x->>'note')) from jsonb_array_elements(r.lines)x),r.locale);
   if result->>'status'<>'accepted' then raise exception 'order_rejected: %',result->>'reason'; end if;
   if exists(select 1 from jsonb_array_elements(r.lines)x join public.menu_items m on m.id=(x->>'itemId')::uuid where x->>'unitCents' is not null and (x->>'unitCents')::integer<>m.price_cents+coalesce((select sum(price_cents) from public.modifier_options where id in (select value::uuid from jsonb_array_elements_text(x->'optionIds'))),0)) then raise exception 'price_changed'; end if;
   update public.order_items set participant_id=r.participant_id where order_id=(result->>'order_id')::uuid;
   update mezza_private.visit_requests set status='accepted',order_id=(result->>'order_id')::uuid where id=r.id;
   update public.tabs set bill_revision=bill_revision+1 where id=t.id;
  else
   if length(btrim(coalesce(p_data->>'reason',''))) not between 3 and 200 then raise exception 'reason_required'; end if;
   if r.status='pending' then update mezza_private.visit_requests set status='rejected',reason=p_data->>'reason' where id=r.id;
   elsif r.status='cancel_requested' and p_op='cancel' then
    if t.status<>'open' then raise exception 'bill_locked'; end if;
    if role_name not in ('owner','manager') then raise exception 'forbidden' using errcode='42501'; end if;
    update public.order_items set voided_at=now(),voided_by=p_actor,void_reason=p_data->>'reason' where order_id=r.order_id and voided_at is null;
    update public.orders set status='void' where id=r.order_id;
    update mezza_private.visit_requests set status='cancelled',reason=p_data->>'reason' where id=r.id;
    update public.tabs set bill_revision=bill_revision+1 where id=t.id;
   elsif r.status='cancel_requested' and p_op='reject' then update mezza_private.visit_requests set status='accepted',reason=p_data->>'reason' where id=r.id;
   else raise exception 'invalid_request_status'; end if;
  end if;
 elsif p_op='request_service' then
  if p_actor is not null or p_data->>'kind' not in ('call_server','bring_check') then raise exception 'forbidden'; end if;
  if not exists(select 1 from public.service_requests where tab_id=t.id and kind=(p_data->>'kind')::public.service_request_kind and status='open') then
   insert into public.service_requests(restaurant_id,tab_id,kind) values(t.restaurant_id,t.id,(p_data->>'kind')::public.service_request_kind);
  end if;
 elsif p_op='rename' then
  if p_actor is not null or length(btrim(coalesce(p_data->>'name',''))) not between 1 and 32 then raise exception 'invalid_name'; end if;
  update public.tab_participants set display_name=btrim(p_data->>'name') where id=s.participant_id;
 elsif p_op='pause' then
  if p_actor is null then raise exception 'forbidden'; end if;
  update public.restaurants set guest_ordering_paused=(p_data->>'paused')::boolean where id=t.restaurant_id;
 elsif p_op='add_person' then
  if p_actor is null or t.status<>'open' or length(btrim(coalesce(p_data->>'name',''))) not between 1 and 32 or (select count(*) from public.tab_participants where tab_id=t.id)>=40 then raise exception 'invalid_participant'; end if;
  insert into public.tab_participants(restaurant_id,tab_id,display_name) values(t.restaurant_id,t.id,btrim(p_data->>'name'));
 elsif p_op in ('remove','recover') then
  if p_actor is null then raise exception 'forbidden'; end if;
  select id into pid from public.tab_participants where tab_id=t.id and id=(p_data->>'participantId')::uuid;
  if pid is null then raise exception 'participant_not_found'; end if;
  update mezza_private.visit_sessions set revoked_at=now(),draft='[]' where participant_id=pid;
  if p_op='remove' then update mezza_private.visit_requests set status='rejected',reason='participant_removed' where tab_id=t.id and participant_id=pid and status='pending'; end if;
  if p_op='recover' then
   if t.status='closed' or length(coalesce(p_data->>'ticketHash',''))<>64 then raise exception 'invalid_recovery'; end if;
   delete from mezza_private.visit_recoveries where participant_id=pid;
   insert into mezza_private.visit_recoveries(ticket_hash,tab_id,participant_id,expires_at) values(p_data->>'ticketHash',t.id,pid,now()+interval '10 minutes');
  end if;
 elsif p_op='freeze' then
  if p_actor is null or t.status<>'open' then raise exception 'bill_locked'; end if;
  perform set_config('mezza.visit_workflow',t.id::text,true);
  if exists(select 1 from mezza_private.visit_requests where tab_id=t.id and status in ('pending','cancel_requested')) then raise exception 'pending_requests'; end if;
  if t.bill_revision<>(p_data->>'revision')::integer then raise exception 'stale_bill'; end if;
  if exists(select 1 from public.payments where tab_id=t.id and status not in ('failed','refunded')) then raise exception 'existing_payments'; end if;
  if exists(select 1 from mezza_private.visit_sessions where tab_id=t.id and revoked_at is null and jsonb_array_length(draft)>0) and coalesce((p_data->>'ackDrafts')::boolean,false)=false then raise exception 'unsent_drafts'; end if;
  snap=public.visit_snapshot(t.id);
  if jsonb_typeof(p_data->'portions')<>'array' or jsonb_array_length(p_data->'portions') not between 1 and 20 then raise exception 'invalid_portions'; end if;
  select coalesce(sum((x->>'qty')::bigint*(x->>'unitCents')::bigint),0) into subtotal from jsonb_array_elements(snap->'lines')x;
  if subtotal=0 then raise exception 'empty_bill'; end if;
  select sum((x->>'subtotalCents')::bigint),sum((x->>'stateCents')::bigint),sum((x->>'municipalCents')::bigint),count(distinct x->>'participantId') into total,st,mu,n from jsonb_array_elements(p_data->'portions')x;
  if total<>subtotal or st<>(snap->'tax'->>'state')::bigint or mu<>(snap->'tax'->>'municipal')::bigint or n<>jsonb_array_length(p_data->'portions') then raise exception 'allocation_mismatch'; end if;
  -- Verify every stored unit allocation, not just aggregate totals.
  for line in select * from jsonb_array_elements(snap->'lines') loop
   for n in 0..(line->>'qty')::integer-1 loop
    select coalesce(sum((a->>'cents')::bigint),0) into total from jsonb_array_elements(p_data->'portions')p cross join lateral jsonb_array_elements(p->'lines')a where a->>'lineId'=line->>'id' and (a->>'unit')::integer=n;
    if total<>(line->>'unitCents')::bigint then raise exception 'unit_allocation_mismatch'; end if;
   end loop;
  end loop;
  for pr in select * from jsonb_array_elements(p_data->'portions') loop
   if not exists(select 1 from public.tab_participants where id=(pr->>'participantId')::uuid and tab_id=t.id) then raise exception 'wrong_participant'; end if;
   select coalesce(sum((a->>'cents')::bigint),0) into total from jsonb_array_elements(pr->'lines')a;
   if total<>(pr->>'subtotalCents')::bigint then raise exception 'allocation_mismatch'; end if;
   if (select count(*) from jsonb_array_elements(pr->'lines'))<>(select count(distinct (x->>'lineId',x->>'unit')) from jsonb_array_elements(pr->'lines')x) then raise exception 'duplicate_unit'; end if;
   for v in select * from jsonb_array_elements(pr->'lines') loop
    if (v->>'cents')::bigint<0 or not exists(select 1 from jsonb_array_elements(snap->'lines')x where x->>'id'=v->>'lineId' and (v->>'unit')::integer>=0 and (v->>'unit')::integer<(x->>'qty')::integer) then raise exception 'unknown_unit'; end if;
   end loop;
   insert into mezza_private.bill_portions(restaurant_id,tab_id,participant_id,label,subtotal_cents,state_cents,municipal_cents,lines)
   select t.restaurant_id,t.id,p.id,p.display_name,(pr->>'subtotalCents')::integer,(pr->>'stateCents')::integer,(pr->>'municipalCents')::integer,pr->'lines' from public.tab_participants p where p.id=(pr->>'participantId')::uuid;
  end loop;
  update public.tabs set status='paying',split_mode=(p_data->>'mode')::public.split_mode,bill_revision=bill_revision+1 where id=t.id;
 elsif p_op='reopen' then
  if p_actor is null or t.status<>'paying' or exists(select 1 from mezza_private.bill_portions where tab_id=t.id and status<>'unpaid') or exists(select 1 from public.payments where tab_id=t.id and status not in ('failed','refunded')) then raise exception 'cannot_reopen'; end if;
  perform set_config('mezza.visit_workflow',t.id::text,true);
  delete from mezza_private.bill_portions where tab_id=t.id;
  update public.tabs set status='open',bill_revision=bill_revision+1 where id=t.id;
 elsif p_op='cash' then
  if p_actor is null or t.status not in ('paying','closed') then raise exception 'forbidden'; end if;
  select array_agg(x::uuid) into wanted from jsonb_array_elements_text(p_data->'portionIds')x;
  if wanted is null or cardinality(wanted)<> (select count(distinct x) from unnest(wanted)x) then raise exception 'invalid_portions'; end if;
  select id into pay from public.payments where restaurant_id=t.restaurant_id and idempotency_key=p_data->>'key';
  if pay is not null then
   if not exists(select 1 from public.payments where id=pay and tab_id=t.id and participant_id=(p_data->>'payerId')::uuid and tip_cents=(p_data->>'tipCents')::integer) or (select array_agg(id order by id) from mezza_private.bill_portions where payment_id=pay) is distinct from (select array_agg(x order by x) from unnest(wanted)x) then raise exception 'payment_key_conflict'; end if;
   return jsonb_build_object('paymentId',pay,'visit',public.visit_snapshot(t.id));
  end if;
  if t.status<>'paying' then raise exception 'bill_locked'; end if;
  if not exists(select 1 from public.tab_participants where id=(p_data->>'payerId')::uuid and tab_id=t.id) then raise exception 'wrong_payer'; end if;
  select count(*),sum(subtotal_cents),sum(state_cents),sum(municipal_cents) into covered,subtotal,st,mu from mezza_private.bill_portions where tab_id=t.id and id=any(wanted) and status='unpaid';
  if covered<>cardinality(wanted) then raise exception 'portion_already_settled'; end if;
  if (p_data->>'tipCents')::bigint<0 or (p_data->>'tipCents')::bigint>1000000 or (p_data->>'tenderCents')::bigint<subtotal+st+mu+(p_data->>'tipCents')::bigint then raise exception 'insufficient_tender'; end if;
  perform set_config('mezza.visit_workflow',t.id::text,true);
  insert into public.payments(restaurant_id,tab_id,participant_id,method,amount_cents,ivu_state_cents,ivu_municipal_cents,tip_cents,status,idempotency_key,paid_at,confirmed_by)
  values(t.restaurant_id,t.id,(p_data->>'payerId')::uuid,'cash',subtotal,st,mu,(p_data->>'tipCents')::integer,'paid',p_data->>'key',now(),p_actor) returning id into pay;
  update mezza_private.bill_portions set status='paid',settled_at=now(),payment_id=pay,actor_id=p_actor where id=any(wanted) and tab_id=t.id;
  insert into mezza_private.visit_receipts(payment_id,tab_id,payer_id,secret_hash,snapshot)
  values(pay,t.id,(p_data->>'payerId')::uuid,coalesce((select receipt_hash from mezza_private.visit_sessions where participant_id=(p_data->>'payerId')::uuid order by expires_at desc limit 1),p_data->>'receiptHash'),jsonb_build_object('paymentId',pay,'restaurant',(select name from public.restaurants where id=t.restaurant_id),'paidAt',now(),'subtotalCents',subtotal,'stateCents',st,'municipalCents',mu,'tipCents',(p_data->>'tipCents')::integer,'portions',(select jsonb_agg(jsonb_build_object('label',label,'lines',lines)) from mezza_private.bill_portions where id=any(wanted) and tab_id=t.id)));
  insert into public.audit_log(restaurant_id,actor_id,action,target_table,target_id,after) values(t.restaurant_id,p_actor,'bill_workflow','payments',pay,jsonb_build_object('operation','cash','portionIds',wanted,'tenderCents',p_data->'tenderCents','changeCents',(p_data->>'tenderCents')::bigint-subtotal-st-mu-(p_data->>'tipCents')::bigint));
  return jsonb_build_object('paymentId',pay,'visit',public.visit_snapshot(t.id));
 elsif p_op='writeoff' then
  if p_actor is null or role_name not in ('owner','manager') or t.status<>'paying' or length(btrim(coalesce(p_data->>'reason',''))) not between 3 and 200 then raise exception 'forbidden' using errcode='42501'; end if;
  update mezza_private.bill_portions set status='written_off',settled_at=now(),reason=p_data->>'reason',actor_id=p_actor where tab_id=t.id and id=(p_data->>'id')::uuid and status='unpaid';
  if not found then raise exception 'portion_already_settled'; end if;
 elsif p_op='close' then
  if p_actor is null or t.status='closed' or (t.status='open' and exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where o.tab_id=t.id and o.status<>'void' and i.voided_at is null and i.unit_price_cents>0)) or (t.status='paying' and not exists(select 1 from mezza_private.bill_portions where tab_id=t.id)) or exists(select 1 from mezza_private.bill_portions where tab_id=t.id and status='unpaid') or exists(select 1 from public.payments where tab_id=t.id and status='pending') then raise exception 'unsettled_bill'; end if;
  if exists(select 1 from mezza_private.visit_requests where tab_id=t.id and status='cancel_requested') then raise exception 'pending_requests'; end if;
  perform set_config('mezza.visit_workflow',t.id::text,true);
  update public.tabs set status='closed',closed_at=now(),pos_closed_at=now(),pos_closed_by=p_actor where id=t.id;
  update mezza_private.visit_sessions set revoked_at=coalesce(revoked_at,now()),draft='[]' where tab_id=t.id;
  update mezza_private.visit_requests set status='rejected',reason='visit_closed' where tab_id=t.id and status='pending';
  update mezza_private.visit_receipts set expires_at=now()+interval '7 days' where tab_id=t.id;
  update public.service_requests set status='handled',handled_by=p_actor,handled_at=now() where tab_id=t.id and status='open';
 else raise exception 'invalid_operation'; end if;
 if p_actor is not null then
  insert into public.audit_log(restaurant_id,actor_id,action,target_table,target_id,after)
  values(t.restaurant_id,p_actor,'bill_workflow','tabs',t.id,jsonb_build_object('operation',p_op)|| (p_data-'ticketHash'-'receiptHash'));
 end if;
 return public.visit_snapshot(t.id);
end $$;

-- Row locks also cover legacy mutations racing a checkout. Only workflow RPC may
-- change managed settlement state or create QR orders/payments.
create function public.guard_managed_bill() returns trigger language plpgsql security definer set search_path='' as $$
declare tid uuid; t public.tabs%rowtype; begin
 if TG_TABLE_NAME='tabs' then
  if old.staff_managed and (new.table_id is distinct from old.table_id or new.restaurant_id is distinct from old.restaurant_id) then raise exception 'immutable_visit'; end if;
  if old.staff_managed and (new.status is distinct from old.status or new.staff_managed is distinct from old.staff_managed or new.bill_state_bps is distinct from old.bill_state_bps or new.bill_municipal_bps is distinct from old.bill_municipal_bps)
   and current_setting('mezza.visit_workflow',true) is distinct from old.id::text then raise exception 'use_bill_workflow'; end if;
  if old.staff_managed and new.status='closed' and old.status<>'closed' and (exists(select 1 from mezza_private.bill_portions where tab_id=old.id and status='unpaid') or (not exists(select 1 from mezza_private.bill_portions where tab_id=old.id) and exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where o.tab_id=old.id and o.status<>'void' and i.voided_at is null and i.unit_price_cents>0))) then raise exception 'unsettled_bill'; end if;
  return new;
 end if;
 if TG_TABLE_NAME in ('orders','payments') then tid=coalesce(new.tab_id,old.tab_id);
 else select tab_id into tid from public.orders where id=coalesce(new.order_id,old.order_id); end if;
 if TG_TABLE_NAME='orders' then
  if TG_OP='UPDATE' and new.tab_id is distinct from old.tab_id and exists(select 1 from public.tabs where id in (new.tab_id,old.tab_id) and staff_managed) then raise exception 'immutable_visit'; end if;
 end if;
 if TG_TABLE_NAME='order_items' then
  if TG_OP='UPDATE' and new.order_id is distinct from old.order_id and exists(select 1 from public.tabs x join public.orders y on y.tab_id=x.id where y.id in (new.order_id,old.order_id) and x.staff_managed) then raise exception 'immutable_visit'; end if;
 end if;
 select * into t from public.tabs where id=tid for update;
 if t.staff_managed then
  if TG_TABLE_NAME='payments' then
   if TG_OP='UPDATE' then
    if (to_jsonb(new)-'status'-'updated_at') is distinct from (to_jsonb(old)-'status'-'updated_at') or new.status not in ('paid','partially_refunded','refunded') then raise exception 'immutable_payment'; end if;
    if new.status is distinct from old.status and new.status is distinct from (select case when coalesce(sum(amount_cents),0)=old.amount_cents+old.ivu_state_cents+old.ivu_municipal_cents+old.tip_cents then 'refunded' when coalesce(sum(amount_cents),0)>0 then 'partially_refunded' else 'paid' end::public.payment_status from public.refunds where payment_id=old.id) then raise exception 'refund_required'; end if;
    return new;
   end if;
   if current_setting('mezza.visit_workflow',true) is distinct from t.id::text then raise exception 'use_bill_workflow'; end if;
  elsif TG_TABLE_NAME='orders' then
   if TG_OP='INSERT' and new.source='qr' and current_setting('mezza.visit_workflow',true) is distinct from t.id::text then raise exception 'staff_acceptance_required'; end if;
   if TG_OP='DELETE' or (TG_OP='INSERT' and t.status<>'open') or (TG_OP='UPDATE' and (new.tab_id is distinct from old.tab_id or (new.status='void' and old.status<>'void')) and t.status<>'open') then raise exception 'bill_locked'; end if;
  else
   if TG_OP='UPDATE' and (to_jsonb(new)-'status'-'updated_at') is not distinct from (to_jsonb(old)-'status'-'updated_at') then return new; end if;
   if t.status<>'open' then raise exception 'bill_locked'; end if;
   update public.tabs set bill_revision=bill_revision+1 where id=t.id;
  end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
create trigger guard_bill_close before update on public.tabs for each row execute function public.guard_managed_bill();
create trigger guard_bill_items before insert or update or delete on public.order_items for each row execute function public.guard_managed_bill();
create trigger guard_bill_orders before insert or update or delete on public.orders for each row execute function public.guard_managed_bill();
create trigger guard_bill_payments before insert or update on public.payments for each row execute function public.guard_managed_bill();
revoke all on function public.guard_managed_bill() from public,anon,authenticated;
revoke all on function public.visit_workflow(text,uuid,uuid,uuid,text,jsonb),public.visit_snapshot(uuid),public.visit_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.visit_workflow(text,uuid,uuid,uuid,text,jsonb),public.visit_snapshot(uuid),public.visit_rate_limit(text,integer,integer) to service_role;

-- Receipt credential is independent of revoked ordering credentials. No visit snapshot
-- is reachable through this function; it returns only this payer's immutable receipts.
create function public.visit_private_receipts(p_hash text,p_table uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(r.snapshot||jsonb_build_object('paymentStatus',p.status,'refundCents',coalesce((select sum(amount_cents) from public.refunds where payment_id=p.id),0)) order by p.paid_at),'[]'::jsonb)
 from mezza_private.visit_receipts r join public.tabs t on t.id=r.tab_id join public.payments p on p.id=r.payment_id
 where r.secret_hash=p_hash and t.table_id=p_table and (r.expires_at is null or r.expires_at>now());
$$;
create function public.visit_claim_recovery(p_ticket_hash text,p_table uuid,p_secret_hash text,p_receipt_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare rec mezza_private.visit_recoveries%rowtype; t public.tabs%rowtype; s mezza_private.visit_sessions%rowtype; begin
 -- Same lock order as all other visit operations.
 perform 1 from public.restaurants where id=(select restaurant_id from public.tabs where id=(select tab_id from mezza_private.visit_recoveries where ticket_hash=p_ticket_hash)) for update;
 select * into t from public.tabs where id=(select tab_id from mezza_private.visit_recoveries where ticket_hash=p_ticket_hash) and table_id=p_table for update;
 if not found or t.status='closed' then raise exception 'invalid_recovery'; end if;
 delete from mezza_private.visit_recoveries where ticket_hash=p_ticket_hash and expires_at>now() returning * into rec;
 if not found or length(coalesce(p_secret_hash,''))<>64 or length(coalesce(p_receipt_hash,''))<>64 then raise exception 'invalid_recovery'; end if;
 update mezza_private.visit_sessions set revoked_at=coalesce(revoked_at,now()),draft='[]' where participant_id=rec.participant_id;
 insert into mezza_private.visit_sessions(restaurant_id,tab_id,participant_id,secret_hash,receipt_hash,expires_at)
 values(t.restaurant_id,t.id,rec.participant_id,p_secret_hash,p_receipt_hash,now()+interval '4 hours') returning * into s;
 update mezza_private.visit_receipts set secret_hash=p_receipt_hash where tab_id=t.id and payer_id=rec.participant_id;
 return jsonb_build_object('participantId',s.participant_id,'expiresAt',s.expires_at,'visit',public.visit_snapshot(t.id));
end $$;
revoke all on function public.visit_private_receipts(text,uuid),public.visit_claim_recovery(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.visit_private_receipts(text,uuid),public.visit_claim_recovery(text,uuid,text,text) to service_role;

create or replace function public.set_order_status(p_order_id uuid, p_status public.order_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  perform 1 from public.restaurants where id=(select restaurant_id from public.orders where id=p_order_id) for update;
  perform 1 from public.tabs where id=(select tab_id from public.orders where id=p_order_id) for update;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not public.has_role(v_order.restaurant_id, array['owner', 'manager', 'server', 'kitchen']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status = 'void' or v_order.status = 'void' then
    raise exception 'use void_order to void an order' using errcode = '22023';
  end if;
  update public.orders set status = p_status where id = p_order_id;
  update public.order_items set status = p_status where order_id = p_order_id and voided_at is null;
end;
$$;

create or replace function public.void_order(p_order_id uuid, p_reason text, p_order_item_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_actor uuid := (select auth.uid());
begin
  perform 1 from public.restaurants where id=(select restaurant_id from public.orders where id=p_order_id) for update;
  perform 1 from public.tabs where id=(select tab_id from public.orders where id=p_order_id) for update;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not public.has_role(v_order.restaurant_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  if p_order_item_id is null then
    update public.order_items
    set status = 'void', voided_at = now(), voided_by = v_actor, void_reason = p_reason
    where order_id = p_order_id and voided_at is null;
    update public.orders set status = 'void' where id = p_order_id;
  else
    update public.order_items
    set status = 'void', voided_at = now(), voided_by = v_actor, void_reason = p_reason
    where id = p_order_item_id and order_id = p_order_id and voided_at is null;
    if not found then
      raise exception 'line not found or already void' using errcode = 'P0002';
    end if;
    if not exists (select 1 from public.order_items where order_id = p_order_id and voided_at is null) then
      update public.orders set status = 'void' where id = p_order_id;
    end if;
  end if;

  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, before, after)
  values (
    v_order.restaurant_id, v_actor, 'void',
    case when p_order_item_id is null then 'orders' else 'order_items' end,
    coalesce(p_order_item_id, p_order_id),
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'void', 'reason', p_reason)
  );
end;
$$;

create function public.visit_financial_summary(p_restaurant uuid,p_actor uuid,p_from date,p_to date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare tz text; result jsonb; begin
 if not exists(select 1 from public.memberships where restaurant_id=p_restaurant and user_id=p_actor and active and role in ('owner','manager')) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>400 then raise exception 'invalid_range'; end if;
 select timezone into tz from public.restaurants where id=p_restaurant;
 select jsonb_build_object('writtenOffCents',coalesce(sum(subtotal_cents+state_cents+municipal_cents),0),'writtenOffCount',count(*)) into result
 from mezza_private.bill_portions where restaurant_id=p_restaurant and status='written_off' and (settled_at at time zone tz)::date between p_from and p_to;
 return result;
end $$;
revoke all on function public.visit_financial_summary(uuid,uuid,date,date) from public,anon,authenticated;
grant execute on function public.visit_financial_summary(uuid,uuid,date,date) to service_role;
