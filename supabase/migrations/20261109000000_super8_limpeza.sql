-- Limpeza automática todo dia às 3h da manhã (horário de Brasília/Maceió = 06:00 UTC).
-- Sai do banco:
--   * torneio já jogado (tem placar) e parado há 6 horas: acabou naquela noite;
--   * torneio sorteado e nunca jogado, ou inscrição, parado há 30 dias: ficou esquecido;
--   * sessões de árbitro vencidas.
-- Partidas, inscritos e sessões do torneio saem junto (on delete cascade).

create or replace function super8.last_activity(t super8.tournaments) returns timestamptz
language sql stable set search_path = '' as $$
  select greatest(
    t.updated_at,
    (select max(m.updated_at) from super8.matches m where m.tournament_id = t.id),
    (select max(e.updated_at) from super8.entries e where e.tournament_id = t.id))
$$;

create or replace function super8.cleanup() returns int
language plpgsql set search_path = '' as $$
declare n int;
begin
  with gone as (
    delete from super8.tournaments t
    where (t.phase = 'jogos'
           and exists (select 1 from super8.matches m where m.tournament_id = t.id and m.sets <> '[]'::jsonb)
           and super8.last_activity(t) < now() - interval '6 hours')
       or super8.last_activity(t) < now() - interval '30 days'
    returning 1)
  select count(*) into n from gone;
  delete from super8.sessions where expires_at < now();
  return n;
end $$;

revoke execute on function super8.last_activity(super8.tournaments) from public, anon, authenticated;
revoke execute on function super8.cleanup() from public, anon, authenticated;

select cron.schedule('super8-limpeza-3h', '0 6 * * *', $$select super8.cleanup()$$);
