-- Jogo extra que só conta para alguns jogadores (os outros completam a quadra),
-- entrar como organizador em outro aparelho e trocar o critério do ranking depois de criado.
alter table super8.matches add column counts text[] check (counts is null or cardinality(counts) between 1 and 4);

create or replace function super8.match_json(m super8.matches) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'stage', m.stage, 'round', m.round, 'division', m.division, 'grp', m.grp,
    'slot', m.slot, 'court', m.court, 'label', m.label, 'a', to_jsonb(m.team_a), 'b', to_jsonb(m.team_b),
    'teamA', m.tid_a, 'teamB', m.tid_b, 'sets', m.sets, 'version', m.version, 'counts', to_jsonb(m.counts))
$$;

create or replace function super8.insert_matches(p_tid uuid, p_matches jsonb, p_allowed_stages text[]) returns int
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
    insert into super8.matches (tournament_id, stage, round, division, grp, slot, court, label, team_a, team_b, tid_a, tid_b, counts)
    values (
      p_tid, e->>'stage', (e->>'round')::int, e->>'division', nullif(e->>'grp', ''), (e->>'slot')::int,
      coalesce((e->>'court')::int, 1), e->>'label',
      array(select jsonb_array_elements_text(e->'a')),
      array(select jsonb_array_elements_text(coalesce(e->'b', '[]'::jsonb))),
      e->>'teamA', e->>'teamB',
      case when jsonb_typeof(e->'counts') = 'array' then array(select jsonb_array_elements_text(e->'counts')) end);
    n := n + 1;
  end loop;
  if (select count(*) from super8.matches where tournament_id = p_tid) > 800 then
    raise exception 'partidas demais' using errcode = '22023';
  end if;
  return n;
end $$;

revoke execute on function super8.match_json(super8.matches) from public, anon, authenticated;
revoke execute on function super8.insert_matches(uuid, jsonb, text[]) from public, anon, authenticated;

create function public.s8_admin_check(p_code text, p_admin_key text) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if p_admin_key is null or super8.sha(p_admin_key) <> t.admin_key_hash then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  return jsonb_build_object('ok', true);
end $$;

create function public.s8_admin_ranking(p_code text, p_admin_key text, p_ranking jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if p_admin_key is null or super8.sha(p_admin_key) <> t.admin_key_hash then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  if jsonb_typeof(p_ranking) is distinct from 'object' or pg_column_size(p_ranking) > 1024
     or not (p_ranking->>'base' in ('games', 'resultado')) then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
  end if;
  update super8.tournaments set config = jsonb_set(config, '{ranking}', p_ranking), version = version + 1, updated_at = now() where id = t.id;
  perform super8.notify(t.code, 'reload', '{}'::jsonb);
  return jsonb_build_object('ok', true);
exception when check_violation then
  return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
end $$;

revoke execute on function public.s8_admin_check(text, text) from public;
revoke execute on function public.s8_admin_ranking(text, text, jsonb) from public;
grant execute on function public.s8_admin_check(text, text) to anon, authenticated;
grant execute on function public.s8_admin_ranking(text, text, jsonb) to anon, authenticated;
