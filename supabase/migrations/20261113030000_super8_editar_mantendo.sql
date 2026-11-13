-- Editar o torneio sem perder placar.
-- O organizador manda o nome, a config e os jogadores novos, a lista de partidas que ficam (p_keep)
-- e as partidas novas. Sai do banco só o que não está em p_keep.
-- Com p_wipe = false, se alguém lançou placar numa partida que ia sair (entre abrir a edição e salvar),
-- nada é gravado e volta CONFLITO: o celular recarrega e monta o plano de novo.
create function public.s8_admin_edit(
  p_code text, p_admin_key text, p_name text, p_config jsonb, p_data jsonb,
  p_keep uuid[], p_matches jsonb, p_wipe boolean, p_expected int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t super8.tournaments;
begin
  select * into t from super8.tournaments where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NAO_ENCONTRADO'); end if;
  if p_admin_key is null or super8.sha(p_admin_key) <> t.admin_key_hash then return jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO'); end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60
     or jsonb_typeof(p_config) is distinct from 'object' or pg_column_size(p_config) > 8192
     or jsonb_typeof(p_data->'players') is distinct from 'array' or jsonb_array_length(p_data->'players') not between 4 and 80 then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
  end if;
  if t.version <> p_expected then return jsonb_build_object('ok', false, 'error', 'CONFLITO'); end if;

  if not coalesce(p_wipe, false) and exists (
    select 1 from super8.matches m
    where m.tournament_id = t.id and not (m.id = any (coalesce(p_keep, '{}'))) and m.sets <> '[]'::jsonb
  ) then
    return jsonb_build_object('ok', false, 'error', 'CONFLITO');
  end if;

  delete from super8.matches m where m.tournament_id = t.id and not (m.id = any (coalesce(p_keep, '{}')));
  update super8.tournaments set name = btrim(p_name), config = p_config, data = p_data, version = version + 1, updated_at = now()
  where id = t.id;
  perform super8.insert_matches(t.id, coalesce(p_matches, '[]'::jsonb), array['rodada', 'grupo']);
  perform super8.notify(t.code, 'reload', '{}'::jsonb);
  return jsonb_build_object('ok', true);
exception
  when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range
    or string_data_right_truncation or invalid_parameter_value or unique_violation then
    return jsonb_build_object('ok', false, 'error', 'DADOS_INVALIDOS');
end $$;

revoke execute on function public.s8_admin_edit(text, text, text, jsonb, jsonb, uuid[], jsonb, boolean, int) from public;
grant execute on function public.s8_admin_edit(text, text, text, jsonb, jsonb, uuid[], jsonb, boolean, int) to anon, authenticated;
