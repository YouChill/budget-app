-- Testy migracji 015: użytkownik nie może przenieść się do cudzego gospodarstwa.
\set ON_ERROR_STOP on

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false) \g /dev/null

-- display_name dalej można zmieniać
UPDATE profiles SET display_name = 'A2' WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a';

-- próba przejęcia gospodarstwa B
DO $$
BEGIN
  BEGIN
    UPDATE profiles SET household_id = '22222222-2222-2222-2222-222222222222'
    WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a';
    RAISE EXCEPTION 'TEST FAIL: zmiana household_id przeszła';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- oczekiwane
  END;
  ASSERT (SELECT count(*) FROM transakcje WHERE household_id = '22222222-2222-2222-2222-222222222222') = 0,
    'A nie widzi transakcji B';
END $$;

RESET ROLE;

-- warstwa 2: nawet po przywróceniu pełnego GRANT trigger blokuje zmianę
GRANT UPDATE ON public.profiles TO authenticated;
SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    UPDATE profiles SET household_id = '22222222-2222-2222-2222-222222222222'
    WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a';
    RAISE EXCEPTION 'TEST FAIL: trigger nie zablokował zmiany household_id';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

-- właściciel (jak trigger handle_new_user / service_role) może przypisać gospodarstwo
UPDATE profiles SET household_id = '11111111-1111-1111-1111-111111111111'
WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a';

DO $$ BEGIN
  ASSERT (SELECT display_name || ' ' || household_id FROM profiles WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a')
    = 'A2 11111111-1111-1111-1111-111111111111', 'profil A bez zmian gospodarstwa';
END $$;

\echo 'OK: wszystkie testy 015 przeszły'
