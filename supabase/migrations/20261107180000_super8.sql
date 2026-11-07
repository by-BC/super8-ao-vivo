-- Super 8 ao vivo
-- Tabelas no schema super8, que não fica exposto na API. O app só fala com o banco pelas funções public.s8_*,
-- que são security definer, validam a entrada e conferem PIN/chave antes de qualquer escrita.

create schema if not exists super8;
revoke all on schema super8 from public, anon, authenticated;

create table super8.tournaments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  name text not null check (char_length(name) between 1 and 60),
  config jsonb not null check (jsonb_typeof(config) = 'object' and pg_column_size(config) < 4096),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 65536),
  version int not null default 1,
  admin_key_hash text not null,
  pin_hash text not null,
  pin_fails int not null default 0,
  pin_fail_since timestamptz,
  pin_locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tournaments_created_at_idx on super8.tournaments (created_at);

create table super8.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references super8.tournaments (id) on delete cascade,
  stage text not null check (stage in ('rodada', 'grupo', 'mata')),
  round int not null check (round between 1 and 200),
  division text not null check (char_length(division) between 1 and 8),
  grp text check (char_length(grp) <= 4),
  slot int not null check (slot between 0 and 500),
  court int not null default 1 check (court between 1 and 60),
  label text check (char_length(label) <= 40),
  team_a text[] not null check (cardinality(team_a) between 1 and 2 and pg_column_size(team_a) < 200),
  team_b text[] not null check (cardinality(team_b) between 0 and 2 and pg_column_size(team_b) < 200),
  tid_a text check (char_length(tid_a) <= 16),
  tid_b text check (char_length(tid_b) <= 16),
  sets jsonb not null default '[]' check (jsonb_typeof(sets) = 'array' and jsonb_array_length(sets) <= 3),
  version int not null default 0,
  updated_at timestamptz not null default now(),
  unique (tournament_id, stage, division, round, slot)
);
create index matches_tournament_idx on super8.matches (tournament_id);

create table super8.sessions (
  token_hash text primary key,
  tournament_id uuid not null references super8.tournaments (id) on delete cascade,
  expires_at timestamptz not null
);
create index sessions_tournament_idx on super8.sessions (tournament_id);

alter table super8.tournaments enable row level security;
alter table super8.matches enable row level security;
alter table super8.sessions enable row level security;
revoke all on all tables in schema super8 from public, anon, authenticated;

/* ---------------- funções internas ---------------- */

create function super8.sha(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p, 'sha256'), 'hex')
$$;

create function super8.new_code() returns text
language plpgsql set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
begin
  loop
    b := extensions.gen_random_bytes(6);
    c := '';
    for i in 0..5 loop
      c := c || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from super8.tournaments where code = c);
  end loop;
  return c;
end $$;

create function super8.match_json(m super8.matches) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'stage', m.stage, 'round', m.round, 'division', m.division, 'grp', m.grp,
    'slot', m.slot, 'court', m.court, 'label', m.label, 'a', to_jsonb(m.team_a), 'b', to_jsonb(m.team_b),
    'teamA', m.tid_a, 'teamB', m.tid_b, 'sets', m.sets, 'version', m.version)
$$;

create function super8.tournament_json(t super8.tournaments) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'code', t.code, 'name', t.name, 'config', t.config, 'data', t.data,
    'version', t.version, 'createdAt', t.created_at, 'updatedAt', t.updated_at)
$$;

-- placar: até 3 sets, cada um [a, b] com inteiros de 0 a 99
create function super8.valid_sets(s jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare e jsonb; x jsonb;
begin
  if s is null or jsonb_typeof(s) <> 'array' or jsonb_array_length(s) > 3 then return false; end if;
  for e in select value from jsonb_array_elements(s) loop
    if jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 2 then return false; end if;
    for x in select value from jsonb_array_elements(e) loop
      if jsonb_typeof(x) <> 'number' or x::numeric < 0 or x::numeric > 99 or x::numeric <> trunc(x::numeric) then return false; end if;
    end loop;
  end loop;
  return true;
end $$;

create function super8.insert_matches(p_tid uuid, p_matches jsonb, p_allowed_stages text[]) returns int
language plpgsql set search_path = '' as $$
declare e jsonb; n int := 0;
begin
  if jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) > 800 then
    raise exception 'lista de partidas inválida' using errcode = '22023';
  end if;
  for e in select value from jsonb_array_elements(p_matches) loop
    if not (e->>'stage' = any (p_allowed_stages)) then
      raise exception 'fase não permitida' using errcode = '22023';
    end if;
    insert into super8.matches (tournament_id, stage, round, division, grp, slot, court, label, team_a, team_b, tid_a, tid_b)
    values (
      p_tid, e->>'stage', (e->>'round')::int, e->>'division', nullif(e->>'grp', ''), (e->>'slot')::int,
      coalesce((e->>'court')::int, 1), e->>'label',
      array(select jsonb_array_elements_text(e->'a')),
      array(select jsonb_array_elements_text(coalesce(e->'b', '[]'::jsonb))),
      e->>'teamA', e->>'teamB');
    n := n + 1;
  end loop;
  if (select count(*) from super8.matches where tournament_id = p_tid) > 800 then
    raise exception 'partidas demais' using errcode = '22023';
  end if;
  return n;
end $$;

-- token de árbitro (sessão do PIN) ou chave do organizador
create function super8.can_score(p_tid uuid, p_token text, p_admin_hash text) returns boolean
language sql stable set search_path = '' as $$
  select p_token is not null and char_length(p_token) between 16 and 128 and (
    super8.sha(p_token) = p_admin_hash
    or exists (select 1 from super8.sessions s where s.token_hash = super8.sha(p_token) and s.tournament_id = p_tid and s.expires_at > now()))
$$;

create function super8.notify(p_code text, p_event text, p_payload jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  perform realtime.send(p_payload, p_event, 's8:' || p_code, false);
exception when others then
  -- falha no aviso em tempo real não pode desfazer o placar; o app ressincroniza sozinho
  raise warning 'super8.notify falhou: %', sqlerrm;
end $$;

revoke execute on all functions in schema super8 from public, anon, authenticated;

/* ---------------- API pública ---------------- */

create function public.s8_create(p_name text, p_config jsonb, p_data jsonb, p_pin text, p_matches jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text; v_admin text; v_token text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then return jsonb_build_object('ok', false, 'error', 'PIN_FORMATO'); end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60
     or jsonb_typeof(p_data->'players') is distinct from 'array'
     or jsonb_array_length(p_data->'players') not between 4 and 64 then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
  end if;
  -- freio contra criação em massa
  if (select count(*) from super8.tournaments where created_at > now() - interval '1 minute') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'MUITAS_TENTATIVAS');
  end if;

  v_code := super8.new_code();
  v_admin := encode(extensions.gen_random_bytes(24), 'hex');
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into super8.tournaments (code, name, config, data, admin_key_hash, pin_hash)
  values (v_code, btrim(p_name), p_config, p_data, super8.sha(v_admin), extensions.crypt(p_pin, extensions.gen_salt('bf', 12)))
  returning id into v_id;
  perform super8.insert_matches(v_id, p_matches, array['rodada', 'grupo']);
  insert into super8.sessions (token_hash, tournament_id, expires_at) values (super8.sha(v_token), v_id, now() + interval '3 days');
  return jsonb_build_object('ok', true, 'code', v_code, 'adminKey', v_admin, 'token', v_token);
exception
  when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range
    or string_data_right_truncation or invalid_parameter_value or unique_violation then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
end $$;

create function public.s8_get(p_code text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  return jsonb_build_object(
    'ok', true,
    'tournament', super8.tournament_json(t),
    'matches', coalesce((select jsonb_agg(super8.match_json(m) order by m.round, m.slot) from super8.matches m where m.tournament_id = t.id), '[]'::jsonb));
end $$;

create function public.s8_unlock(p_code text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments; v_token text;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if t.pin_locked_until is not null and t.pin_locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'BLOQUEADO', 'until', t.pin_locked_until);
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' or extensions.crypt(p_pin, t.pin_hash) <> t.pin_hash then
    -- conta o erro sem lançar exceção, senão o contador seria desfeito junto com a transação
    if t.pin_fail_since is null or t.pin_fail_since < now() - interval '15 minutes' then
      update super8.tournaments set pin_fails = 1, pin_fail_since = now() where id = t.id;
    elsif t.pin_fails + 1 >= 8 then
      update super8.tournaments set pin_fails = 0, pin_fail_since = null, pin_locked_until = now() + interval '15 minutes' where id = t.id;
      return jsonb_build_object('ok', false, 'error', 'BLOQUEADO', 'until', now() + interval '15 minutes');
    else
      update super8.tournaments set pin_fails = pin_fails + 1 where id = t.id;
    end if;
    return jsonb_build_object('ok', false, 'error', 'PIN_INVALIDO');
  end if;

  update super8.tournaments set pin_fails = 0, pin_fail_since = null where id = t.id;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into super8.sessions (token_hash, tournament_id, expires_at) values (super8.sha(v_token), t.id, now() + interval '3 days');
  return jsonb_build_object('ok', true, 'token', v_token);
end $$;

create function public.s8_score(p_code text, p_token text, p_match uuid, p_expected int, p_sets jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments; m super8.matches;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if not super8.can_score(t.id, p_token, t.admin_key_hash) then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  if not super8.valid_sets(p_sets) then return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS'); end if;

  -- trava otimista: só grava se ninguém mexeu nessa partida desde a versão que o celular conhecia
  update super8.matches set sets = p_sets, version = version + 1, updated_at = now()
  where id = p_match and tournament_id = t.id and version = p_expected
  returning * into m;
  if not found then
    select * into m from super8.matches where id = p_match and tournament_id = t.id;
    if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
    return jsonb_build_object('ok', false, 'error', 'CONFLITO', 'match', super8.match_json(m));
  end if;

  perform super8.notify(t.code, 'match', jsonb_build_object('match', super8.match_json(m)));
  return jsonb_build_object('ok', true, 'match', super8.match_json(m));
end $$;

create function public.s8_add_matches(p_code text, p_token text, p_matches jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if not super8.can_score(t.id, p_token, t.admin_key_hash) then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  begin
    perform super8.insert_matches(t.id, p_matches, array['rodada', 'mata']);
  exception
    when unique_violation then return jsonb_build_object('ok', false, 'error', 'JA_GERADO');
    when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range
      or string_data_right_truncation or invalid_parameter_value then
      return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
  end;
  perform super8.notify(t.code, 'reload', '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

create function public.s8_admin_update(p_code text, p_admin_key text, p_name text, p_data jsonb, p_expected int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if p_admin_key is null or super8.sha(p_admin_key) <> t.admin_key_hash then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 or jsonb_typeof(p_data->'players') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
  end if;
  update super8.tournaments set name = btrim(p_name), data = p_data, version = version + 1, updated_at = now()
  where id = t.id and version = p_expected;
  if not found then return jsonb_build_object('ok', false, 'error', 'CONFLITO'); end if;
  perform super8.notify(t.code, 'reload', '{}'::jsonb);
  return jsonb_build_object('ok', true);
exception when check_violation then
  return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
end $$;

create function public.s8_admin_reset(p_code text, p_admin_key text, p_config jsonb, p_data jsonb, p_matches jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if p_admin_key is null or super8.sha(p_admin_key) <> t.admin_key_hash then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  if jsonb_typeof(p_data->'players') is distinct from 'array' or jsonb_array_length(p_data->'players') not between 4 and 64 then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
  end if;
  delete from super8.matches where tournament_id = t.id;
  update super8.tournaments set config = p_config, data = p_data, version = version + 1, updated_at = now() where id = t.id;
  perform super8.insert_matches(t.id, p_matches, array['rodada', 'grupo']);
  perform super8.notify(t.code, 'reload', '{}'::jsonb);
  return jsonb_build_object('ok', true);
exception
  when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range
    or string_data_right_truncation or invalid_parameter_value or unique_violation then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
end $$;

create function public.s8_admin_pin(p_code text, p_admin_key text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if p_admin_key is null or super8.sha(p_admin_key) <> t.admin_key_hash then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then return jsonb_build_object('ok', false, 'error', 'PIN_FORMATO'); end if;
  update super8.tournaments
  set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 12)), pin_fails = 0, pin_fail_since = null, pin_locked_until = null
  where id = t.id;
  -- quem entrou com o PIN antigo perde o acesso na hora
  update super8.sessions set expires_at = now() where tournament_id = t.id and expires_at > now();
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.s8_create(text, jsonb, jsonb, text, jsonb) from public;
revoke execute on function public.s8_get(text) from public;
revoke execute on function public.s8_unlock(text, text) from public;
revoke execute on function public.s8_score(text, text, uuid, int, jsonb) from public;
revoke execute on function public.s8_add_matches(text, text, jsonb) from public;
revoke execute on function public.s8_admin_update(text, text, text, jsonb, int) from public;
revoke execute on function public.s8_admin_reset(text, text, jsonb, jsonb, jsonb) from public;
revoke execute on function public.s8_admin_pin(text, text, text) from public;

grant execute on function public.s8_create(text, jsonb, jsonb, text, jsonb) to anon, authenticated;
grant execute on function public.s8_get(text) to anon, authenticated;
grant execute on function public.s8_unlock(text, text) to anon, authenticated;
grant execute on function public.s8_score(text, text, uuid, int, jsonb) to anon, authenticated;
grant execute on function public.s8_add_matches(text, text, jsonb) to anon, authenticated;
grant execute on function public.s8_admin_update(text, text, text, jsonb, int) to anon, authenticated;
grant execute on function public.s8_admin_reset(text, text, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.s8_admin_pin(text, text, text) to anon, authenticated;
