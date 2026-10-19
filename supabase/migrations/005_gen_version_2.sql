-- ============================================================================
-- Daily generator version 2.
--
-- World generation changed: from this build on a daily mine may hide gas
-- pockets (and may send the Tunneler worm), rolled from the day's seed. The
-- seed itself includes the generator version, so builds on version 1 and
-- version 2 dig different daily mines, and the board must only compare runs
-- from the same one. This moves the daily board to version 2.
--
-- Apply it once the build with CFG.online.genVersion = 2 is live, ideally
-- just after 00:00 UTC: the board drops that day's version-1 runs, and
-- version-1 builds have their daily runs refused (stale_daily) from now on.
-- ============================================================================

update public.app_config set value = '2' where key = 'gen_version';
