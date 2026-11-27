-- Trenér nevidí děti, když se místo jeho lekce jmenuje jinak než místo kroužku.
--
-- Děti mají v `participants.active_course` hodnotu `products.place`
-- (např. „Jesenice · ZŠ Zdiměřice"). Trenérská aplikace skládá místo lekce
-- jako `coach_sessions.city || ' · ' || venue`. U kroužku Zdiměřice je ale
-- `products.city = 'Zdiměřice'` a `place = 'Jesenice · ZŠ Zdiměřice'`, takže
-- trenér, který si kroužek přidal, dostal lekci „Zdiměřice · ZŠ Zdiměřice"
-- a žádné dítě se mu nespárovalo (27. 11. 2026, David ve Zdiměřicích).
--
-- Oprava u zdroje: při zápisu lekce se město vezme z místa kroužku. Platí pro
-- všechny cesty, kterými lekce vzniká (aplikace i ve starých verzích, admin).

create or replace function public.teamvys_course_place_city(p_city text, p_venue text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select split_part(p.place, ' · ', 1)
  from public.products p
  where p.type = 'Kroužek'
    and p.venue = p_venue
    and p.city = p_city
    and p.place like '% · ' || p_venue
    and p.place <> p_city || ' · ' || p_venue
  order by p.is_published desc, p.created_at
  limit 1;
$$;

create or replace function public.teamvys_normalize_coach_session_place()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_city text;
begin
  if new.city is null or new.venue is null then
    return new;
  end if;
  v_city := public.teamvys_course_place_city(new.city, new.venue);
  if v_city is not null and v_city <> '' then
    new.city := v_city;
  end if;
  return new;
end;
$$;

drop trigger if exists teamvys_coach_session_place on public.coach_sessions;
create trigger teamvys_coach_session_place
  before insert or update of city, venue on public.coach_sessions
  for each row execute function public.teamvys_normalize_coach_session_place();

-- Stejná oprava pro seznam míst v profilu trenéra (aplikace ho skládá sama).
create or replace function public.teamvys_normalize_coach_profile_places()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fix text;
begin
  if new.current_location is not null and position(' · ' in new.current_location) > 0 then
    v_fix := public.teamvys_course_place_city(split_part(new.current_location, ' · ', 1), substr(new.current_location, position(' · ' in new.current_location) + 3));
    if v_fix is not null and v_fix <> '' then
      new.current_location := v_fix || ' · ' || substr(new.current_location, position(' · ' in new.current_location) + 3);
    end if;
  end if;
  if new.assigned_courses is not null then
    new.assigned_courses := (
      select coalesce(array_agg(distinct fixed), '{}')
      from (
        select case
          when position(' · ' in item) > 0
            and public.teamvys_course_place_city(split_part(item, ' · ', 1), substr(item, position(' · ' in item) + 3)) is not null
          then public.teamvys_course_place_city(split_part(item, ' · ', 1), substr(item, position(' · ' in item) + 3)) || ' · ' || substr(item, position(' · ' in item) + 3)
          else item
        end as fixed
        from unnest(new.assigned_courses) as item
      ) q
    );
  end if;
  return new;
end;
$$;

drop trigger if exists teamvys_coach_profile_places on public.coach_profiles;
create trigger teamvys_coach_profile_places
  before insert or update of current_location, assigned_courses on public.coach_profiles
  for each row execute function public.teamvys_normalize_coach_profile_places();

revoke all on function public.teamvys_course_place_city(text, text) from public, anon, authenticated;

-- Oprava existujících řádků (trigger je přepíše při dotyku).
update public.coach_sessions set city = city where public.teamvys_course_place_city(city, venue) is not null;
update public.coach_profiles set assigned_courses = assigned_courses
  where exists (select 1 from unnest(assigned_courses) as item where position(' · ' in item) > 0
    and public.teamvys_course_place_city(split_part(item, ' · ', 1), substr(item, position(' · ' in item) + 3)) is not null)
     or (current_location is not null and position(' · ' in current_location) > 0
    and public.teamvys_course_place_city(split_part(current_location, ' · ', 1), substr(current_location, position(' · ' in current_location) + 3)) is not null);
