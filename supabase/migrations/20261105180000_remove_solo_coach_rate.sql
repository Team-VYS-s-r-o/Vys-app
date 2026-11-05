-- Zrušení „solo" sazby trenéra (750 Kč/h, když byl na místě/dni/čase sám).
-- Pravidlo bylo schované v kódu i v tomhle triggeru a nikdo o něm nevěděl;
-- David 5. 11. 2026: vždy 500 Kč/h, respektive sazba nastavená na session.
create or replace function public.teamvys_resolve_coach_attendance_rate(
  p_session_id text,
  p_coach_id text,
  p_default_rate integer default 500
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target_session public.coach_sessions%rowtype;
  normal_rate integer := coalesce(p_default_rate, 500);
begin
  select * into target_session from public.coach_sessions where id = p_session_id;
  if not found then
    return normal_rate;
  end if;
  return coalesce(target_session.hourly_rate, normal_rate, 500);
end;
$function$;
