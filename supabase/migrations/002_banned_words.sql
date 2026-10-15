-- ============================================================================
-- Starter blocklist for display names (English + Chinese), plus names that
-- would impersonate the studio or staff. Matching is on the lower-cased NFKC
-- form with spaces, _ and - removed ('part'), or on whole words ('word').
--
-- This is a floor, not a wall: add rows from the Supabase table editor
-- whenever a bad name slips through. Rename an offender with
--   update profiles set display_name = null, name_key = null where id = '…';
-- ============================================================================

insert into public.banned_words (word, match) values
  -- studio / staff impersonation
  ('admin', 'part'), ('moderator', 'part'), ('hdexpanse', 'part'),
  ('official', 'part'), ('support', 'word'), ('staff', 'word'), ('mod', 'word'),
  ('管理员', 'part'), ('官方', 'part'), ('客服', 'part'), ('版主', 'part'),

  -- English profanity and slurs. Words that sit inside innocent ones
  -- (grape, peacock, spicy, torpedo) are whole-word only.
  ('fuck', 'part'), ('shit', 'part'), ('bitch', 'part'), ('cunt', 'part'),
  ('nigger', 'part'), ('nigga', 'part'), ('faggot', 'part'), ('retard', 'part'),
  ('whore', 'part'), ('slut', 'part'), ('pussy', 'part'), ('dick', 'word'),
  ('cock', 'word'), ('penis', 'part'), ('vagina', 'part'), ('rape', 'word'),
  ('nazi', 'part'), ('hitler', 'part'), ('kike', 'word'), ('chink', 'word'),
  ('spic', 'word'), ('tranny', 'part'), ('dyke', 'part'), ('wank', 'part'),
  ('bastard', 'part'), ('asshole', 'part'), ('porn', 'part'), ('pedo', 'word'),
  ('molest', 'part'), ('kkk', 'part'),

  -- short English words that hide inside innocent names (whole word only)
  ('ass', 'word'), ('fag', 'word'), ('cum', 'word'), ('tit', 'word'),
  ('tits', 'word'), ('sex', 'word'), ('jew', 'word'), ('gay', 'word'),
  ('hoe', 'word'), ('fck', 'word'), ('fk', 'word'), ('wtf', 'word'),

  -- Chinese profanity (substring)
  ('傻逼', 'part'), ('煞笔', 'part'), ('沙比', 'part'), ('傻b', 'part'), ('sb', 'word'),
  ('操你', 'part'), ('草你', 'part'), ('肏', 'part'), ('日你', 'part'),
  ('他妈', 'part'), ('你妈', 'part'), ('妈的', 'part'), ('尼玛', 'part'), ('草泥马', 'part'),
  ('鸡巴', 'part'), ('几把', 'part'), ('屌', 'part'), ('装逼', 'part'), ('牛逼', 'part'),
  ('婊', 'part'), ('贱人', 'part'), ('狗日', 'part'), ('王八蛋', 'part'),
  ('杂种', 'part'), ('畜生', 'part'), ('去死', 'part'), ('强奸', 'part'),
  ('色情', 'part'), ('黄片', 'part'), ('nmsl', 'part'), ('cnm', 'word'), ('tmd', 'word')
on conflict (word) do nothing;
