-- ============================================================================
-- set_display_name, with its character checks written as plain-ASCII escapes.
--
-- 001 wrote the forbidden characters (no-break and zero-width spaces, BOM,
-- direction marks...) into the regex literally. Pasting the file into the SQL
-- Editor can strip or convert those invisible characters, which leaves a
-- range with a missing or swapped end and makes EVERY rename fail with
-- "invalid regular expression: invalid character range". Same rules, same codes; only the
-- spelling of the character classes changes. Grants carry over (create or
-- replace keeps them).
-- ============================================================================

create or replace function public.set_display_name(new_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := auth.uid();
  nm   text;
  key  text;
  bare text;
  prev timestamptz;
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;

  nm := regexp_replace(btrim(normalize(coalesce(new_name, ''), nfkc)), '\s+', ' ', 'g');
  if char_length(nm) < 2 or char_length(nm) > 15 then
    raise exception 'name_length';
  end if;
  -- Control and invisible characters, ASCII punctuation (bar _ and -), and
  -- the common emoji and symbol blocks.
  if nm ~ '[\x01-\x1f\x7f\u00a0\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u2000-\u200f\u2028-\u202f\u205f-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0]'
     or nm ~ '[!-,./:-@\[-\^`{-~]'
     or nm ~ '[\u2190-\u2bff\u3000-\u303f\uff01-\uff0f\U0001f000-\U0001faff\U000e0000-\U000e007f]' then
    raise exception 'name_chars';
  end if;

  key  := lower(nm);
  bare := regexp_replace(key, '[ _-]', '', 'g');
  if exists (
    select 1 from public.banned_words b
     where (b.match = 'part' and strpos(bare, b.word) > 0)
        or (b.match = 'word' and key ~ ('(^|[ _-])' || b.word || '($|[ _-])'))
  ) then
    raise exception 'name_banned';
  end if;

  select name_changed_at into prev from public.profiles where id = uid;
  if not found then
    insert into public.profiles (id) values (uid);
  elsif prev is not null
        and prev > now() - make_interval(days => public.cfg_int('name_cooldown_days'))
        and (select name_key from public.profiles where id = uid) is distinct from key then
    raise exception 'name_cooldown';
  end if;

  begin
    update public.profiles
       set display_name = nm, name_key = key,
           -- Re-casing your own name is free; the clock is for new names.
           name_changed_at = case when name_key is distinct from key then now() else name_changed_at end
     where id = uid;
  exception when unique_violation then
    raise exception 'name_taken';
  end;
  return nm;
end $$;
