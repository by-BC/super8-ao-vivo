-- Inscrição pelo link: antes do sorteio a galera coloca nome, gênero e nível (A a D) pelo celular.
-- O organizador vê os níveis, ajusta, fecha e sorteia. Ninguém é apagado de verdade: sair/remover só muda o status.

alter table super8.tournaments
  add column phase text not null default 'jogos' check (phase in ('inscricao', 'jogos')),
  add column signup jsonb not null default '{}'::jsonb check (jsonb_typeof(signup) = 'object' and pg_column_size(signup) < 2048);

create table super8.entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references super8.tournaments (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  name_key text not null check (char_length(name_key) between 2 and 40),
  gender text check (gender in ('H', 'M')),
  level int check (level between 1 and 4),
  token_hash text,
  status text not null default 'ativo' check (status in ('ativo', 'saiu', 'removido')),
  by_admin boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now()
);
create unique index entries_name_idx on super8.entries (tournament_id, name_key) where status = 'ativo';
create index entries_tournament_idx on super8.entries (tournament_id, created_at);
alter table super8.entries enable row level security;
revoke all on super8.entries from public, anon, authenticated;

/* ---------------- funções internas ---------------- */

create function super8.clean_name(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')
$$;

-- "Ana Luíza" e "ana luiza" contam como o mesmo nome
create function super8.name_key(p text) returns text
language sql immutable set search_path = '' as $$
  select translate(lower(super8.clean_name(p)), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
$$;

-- só as opções que o app entende, com limites
create function super8.signup_settings(p jsonb, p_open boolean) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'open', coalesce(p_open, case when jsonb_typeof(p->'open') = 'boolean' then (p->>'open')::boolean end, true),
    'askGender', coalesce(case when jsonb_typeof(p->'askGender') = 'boolean' then (p->>'askGender')::boolean end, true),
    'askLevel', coalesce(case when jsonb_typeof(p->'askLevel') = 'boolean' then (p->>'askLevel')::boolean end, true),
    'gender', case when p->>'gender' in ('H', 'M') then p->>'gender' end,
    'perGender', coalesce(case when jsonb_typeof(p->'perGender') = 'boolean' then (p->>'perGender')::boolean end, false),
    'limit', case when jsonb_typeof(p->'limit') = 'number' and (p->>'limit')::numeric between 2 and 64
                  then floor((p->>'limit')::numeric)::int end)
$$;

-- valida nome, gênero e nível; devolve o código do erro ou null
create function super8.entry_error(t super8.tournaments, p_name text, p_gender text, p_level int, p_skip uuid, p_strict boolean) returns text
language plpgsql stable set search_path = '' as $$
declare n text := super8.clean_name(p_name);
begin
  if char_length(n) not between 2 and 40 then return 'NOME_INVALIDO'; end if;
  if p_gender is not null and p_gender not in ('H', 'M') then return 'DADOS_INVALIDOS'; end if;
  if p_level is not null and p_level not between 1 and 4 then return 'DADOS_INVALIDOS'; end if;
  if coalesce((t.signup->>'askGender')::boolean, false) and t.signup->>'gender' is null and p_gender is null then return 'GENERO_FALTANDO'; end if;
  if p_strict and coalesce((t.signup->>'askLevel')::boolean, false) and p_level is null then return 'NIVEL_FALTANDO'; end if;
  if exists (select 1 from super8.entries e
             where e.tournament_id = t.id and e.status = 'ativo' and e.name_key = super8.name_key(n) and e.id is distinct from p_skip) then
    return 'NOME_REPETIDO';
  end if;
  return null;
end $$;

-- posição na fila (por gênero quando as vagas são por gênero) e se caiu na lista de espera
create function super8.entry_status(t super8.tournaments, e super8.entries) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('position', s.pos, 'waiting', s.lim is not null and s.pos > s.lim)
  from (
    select (select count(*) from super8.entries x
            where x.tournament_id = t.id and x.status = 'ativo' and (x.created_at, x.id) <= (e.created_at, e.id)
              and (not coalesce((t.signup->>'perGender')::boolean, false) or x.gender is not distinct from e.gender)) as pos,
           (t.signup->>'limit')::int as lim
  ) s
$$;

create or replace function super8.tournament_json(t super8.tournaments) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'code', t.code, 'name', t.name, 'config', t.config, 'data', t.data,
    'version', t.version, 'createdAt', t.created_at, 'updatedAt', t.updated_at,
    'phase', t.phase, 'signup', t.signup)
$$;

revoke execute on all functions in schema super8 from public, anon, authenticated;

/* ---------------- API pública ---------------- */

-- lista pública só tem nome e gênero; o nível fica com o organizador
create or replace function public.s8_get(p_code text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  return jsonb_build_object(
    'ok', true,
    'tournament', super8.tournament_json(t),
    'matches', coalesce((select jsonb_agg(super8.match_json(m) order by m.round, m.slot) from super8.matches m where m.tournament_id = t.id), '[]'::jsonb),
    'entries', case when t.phase = 'inscricao' then coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'gender', e.gender) order by e.created_at, e.id)
      from super8.entries e where e.tournament_id = t.id and e.status = 'ativo'), '[]'::jsonb) end);
end $$;

create function public.s8_create_signup(p_name text, p_config jsonb, p_pin text, p_signup jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text; v_admin text; v_token text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then return jsonb_build_object('ok', false, 'error', 'PIN_FORMATO'); end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60
     or jsonb_typeof(p_config) is distinct from 'object' or jsonb_typeof(coalesce(p_signup, '{}'::jsonb)) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
  end if;
  if (select count(*) from super8.tournaments where created_at > now() - interval '1 minute') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'MUITAS_TENTATIVAS');
  end if;

  v_code := super8.new_code();
  v_admin := encode(extensions.gen_random_bytes(24), 'hex');
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into super8.tournaments (code, name, config, data, admin_key_hash, pin_hash, phase, signup)
  values (v_code, btrim(p_name), p_config, '{"players": [], "teams": []}'::jsonb, super8.sha(v_admin),
          extensions.crypt(p_pin, extensions.gen_salt('bf', 12)), 'inscricao', super8.signup_settings(coalesce(p_signup, '{}'::jsonb), true))
  returning id into v_id;
  insert into super8.sessions (token_hash, tournament_id, expires_at) values (super8.sha(v_token), v_id, now() + interval '3 days');
  return jsonb_build_object('ok', true, 'code', v_code, 'adminKey', v_admin, 'token', v_token);
exception
  when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range
    or string_data_right_truncation or invalid_parameter_value then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
end $$;

create function public.s8_signup(p_code text, p_name text, p_gender text, p_level int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments; e super8.entries; v_err text; v_token text; v_gender text; v_level int;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if t.phase <> 'inscricao' or not coalesce((t.signup->>'open')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'INSCRICAO_FECHADA');
  end if;
  if (select count(*) from super8.entries where tournament_id = t.id and created_at > now() - interval '1 minute') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'MUITAS_TENTATIVAS');
  end if;
  if (select count(*) from super8.entries where tournament_id = t.id and status = 'ativo') >= 100 then
    return jsonb_build_object('ok', false, 'error', 'LOTADO');
  end if;

  v_gender := coalesce(t.signup->>'gender', case when (t.signup->>'askGender')::boolean then p_gender end);
  v_level := case when (t.signup->>'askLevel')::boolean then p_level end;
  v_err := super8.entry_error(t, p_name, v_gender, v_level, null, true);
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  insert into super8.entries (tournament_id, name, name_key, gender, level, token_hash)
  values (t.id, super8.clean_name(p_name), super8.name_key(p_name), v_gender, v_level, super8.sha(v_token))
  returning * into e;
  update super8.tournaments set updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true, 'id', e.id, 'token', v_token) || super8.entry_status(t, e);
exception
  when unique_violation then return jsonb_build_object('ok', false, 'error', 'NOME_REPETIDO');
  when invalid_text_representation or check_violation or not_null_violation or string_data_right_truncation then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
end $$;

-- a própria pessoa edita ou sai, com o token que ficou no celular dela
create function public.s8_signup_edit(p_code text, p_id uuid, p_token text, p_name text, p_gender text, p_level int, p_leave boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments; e super8.entries; v_err text; v_gender text; v_level int;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if t.phase <> 'inscricao' then return jsonb_build_object('ok', false, 'error', 'INSCRICAO_FECHADA'); end if;
  select * into e from super8.entries
  where id = p_id and tournament_id = t.id and status = 'ativo' and p_token is not null and token_hash = super8.sha(p_token);
  if not found then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;

  if coalesce(p_leave, false) then
    update super8.entries set status = 'saiu', updated_at = now() where id = e.id;
    update super8.tournaments set updated_at = now() where id = t.id;
    return jsonb_build_object('ok', true);
  end if;

  if not coalesce((t.signup->>'open')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'INSCRICAO_FECHADA'); end if;
  v_gender := coalesce(t.signup->>'gender', case when (t.signup->>'askGender')::boolean then p_gender end);
  v_level := case when (t.signup->>'askLevel')::boolean then p_level end;
  v_err := super8.entry_error(t, p_name, v_gender, v_level, e.id, true);
  if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
  update super8.entries set name = super8.clean_name(p_name), name_key = super8.name_key(p_name), gender = v_gender, level = v_level, updated_at = now()
  where id = e.id returning * into e;
  update super8.tournaments set updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true) || super8.entry_status(t, e);
exception
  when unique_violation then return jsonb_build_object('ok', false, 'error', 'NOME_REPETIDO');
  when invalid_text_representation or check_violation or not_null_violation or string_data_right_truncation then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
end $$;

/* ---------------- organizador ---------------- */

create function public.s8_admin_entries(p_code text, p_admin_key text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if p_admin_key is null or super8.sha(p_admin_key) <> t.admin_key_hash then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  return jsonb_build_object('ok', true, 'entries', coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'gender', e.gender, 'level', e.level, 'byAdmin', e.by_admin, 'createdAt', e.created_at)
                     order by e.created_at, e.id)
    from super8.entries e where e.tournament_id = t.id and e.status = 'ativo'), '[]'::jsonb));
end $$;

-- p_id nulo adiciona; p_remove tira da lista; senão edita
create function public.s8_admin_entry(p_code text, p_admin_key text, p_id uuid, p_name text, p_gender text, p_level int, p_remove boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments; e super8.entries; v_err text;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if p_admin_key is null or super8.sha(p_admin_key) <> t.admin_key_hash then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  if t.phase <> 'inscricao' then return jsonb_build_object('ok', false, 'error', 'INSCRICAO_FECHADA'); end if;

  if p_id is null then
    if (select count(*) from super8.entries where tournament_id = t.id and status = 'ativo') >= 100 then
      return jsonb_build_object('ok', false, 'error', 'LOTADO');
    end if;
    v_err := super8.entry_error(t, p_name, coalesce(t.signup->>'gender', p_gender), p_level, null, false);
    if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
    insert into super8.entries (tournament_id, name, name_key, gender, level, by_admin)
    values (t.id, super8.clean_name(p_name), super8.name_key(p_name), coalesce(t.signup->>'gender', p_gender), p_level, true)
    returning * into e;
  else
    select * into e from super8.entries where id = p_id and tournament_id = t.id and status = 'ativo';
    if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
    if coalesce(p_remove, false) then
      update super8.entries set status = 'removido', updated_at = now() where id = e.id;
    else
      v_err := super8.entry_error(t, p_name, coalesce(t.signup->>'gender', p_gender), p_level, e.id, false);
      if v_err is not null then return jsonb_build_object('ok', false, 'error', v_err); end if;
      update super8.entries set name = super8.clean_name(p_name), name_key = super8.name_key(p_name),
        gender = coalesce(t.signup->>'gender', p_gender), level = p_level, updated_at = now()
      where id = e.id;
    end if;
  end if;
  update super8.tournaments set updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true, 'id', e.id);
exception
  when unique_violation then return jsonb_build_object('ok', false, 'error', 'NOME_REPETIDO');
  when invalid_text_representation or check_violation or not_null_violation or string_data_right_truncation then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
end $$;

-- abrir/fechar, limite de vagas e o que perguntar
create function public.s8_admin_signup(p_code text, p_admin_key text, p_signup jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if p_admin_key is null or super8.sha(p_admin_key) <> t.admin_key_hash then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  if t.phase <> 'inscricao' then return jsonb_build_object('ok', false, 'error', 'INSCRICAO_FECHADA'); end if;
  if jsonb_typeof(p_signup) is distinct from 'object' then return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS'); end if;
  update super8.tournaments set signup = super8.signup_settings(p_signup, null), updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true);
end $$;

-- fecha a inscrição e grava o sorteio (jogadores, ajustes e partidas) de uma vez
create function public.s8_admin_start(p_code text, p_admin_key text, p_config jsonb, p_data jsonb, p_matches jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if p_admin_key is null or super8.sha(p_admin_key) <> t.admin_key_hash then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  if t.phase <> 'inscricao' or exists (select 1 from super8.matches where tournament_id = t.id) then
    return jsonb_build_object('ok', false, 'error', 'JA_GERADO');
  end if;
  if jsonb_typeof(p_config) is distinct from 'object' or jsonb_typeof(p_data->'players') is distinct from 'array'
     or jsonb_array_length(p_data->'players') not between 4 and 64 then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
  end if;
  update super8.tournaments
  set config = p_config, data = p_data, phase = 'jogos', signup = signup || '{"open": false}'::jsonb, version = version + 1, updated_at = now()
  where id = t.id;
  perform super8.insert_matches(t.id, p_matches, array['rodada', 'grupo']);
  return jsonb_build_object('ok', true);
exception
  when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range
    or string_data_right_truncation or invalid_parameter_value or unique_violation then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
end $$;

revoke execute on function public.s8_create_signup(text, jsonb, text, jsonb) from public;
revoke execute on function public.s8_signup(text, text, text, int) from public;
revoke execute on function public.s8_signup_edit(text, uuid, text, text, text, int, boolean) from public;
revoke execute on function public.s8_admin_entries(text, text) from public;
revoke execute on function public.s8_admin_entry(text, text, uuid, text, text, int, boolean) from public;
revoke execute on function public.s8_admin_signup(text, text, jsonb) from public;
revoke execute on function public.s8_admin_start(text, text, jsonb, jsonb, jsonb) from public;

grant execute on function public.s8_create_signup(text, jsonb, text, jsonb) to anon, authenticated;
grant execute on function public.s8_signup(text, text, text, int) to anon, authenticated;
grant execute on function public.s8_signup_edit(text, uuid, text, text, text, int, boolean) to anon, authenticated;
grant execute on function public.s8_admin_entries(text, text) to anon, authenticated;
grant execute on function public.s8_admin_entry(text, text, uuid, text, text, int, boolean) to anon, authenticated;
grant execute on function public.s8_admin_signup(text, text, jsonb) to anon, authenticated;
grant execute on function public.s8_admin_start(text, text, jsonb, jsonb, jsonb) to anon, authenticated;
