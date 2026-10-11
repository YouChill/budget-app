-- Dane testowe wstawiane PRZED migracją 014 (sprawdzają backfill).
INSERT INTO auth.users VALUES ('aaaaaaaa-0000-0000-0000-00000000000a','a@test'), ('bbbbbbbb-0000-0000-0000-00000000000b','b@test');
INSERT INTO public.households (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111','A'), ('22222222-2222-2222-2222-222222222222','B');
INSERT INTO public.profiles (id, household_id, display_name) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','A'),
  ('bbbbbbbb-0000-0000-0000-00000000000b','22222222-2222-2222-2222-222222222222','B');
INSERT INTO public.transakcje (id, household_id, data, typ, kwota, kategoria, podkategoria, osoba, komentarz) VALUES
  ('00000000-0000-0000-0000-0000000000a1','11111111-1111-1111-1111-111111111111','2026-09-10','Wydatek',132.74,'Rachunki','Woda','Paweł','PWIK faktura 9029/2026 [udział 1/2 z 265,47 zł]'),
  ('00000000-0000-0000-0000-0000000000a2','11111111-1111-1111-1111-111111111111','2026-09-12','Wydatek',800.00,'Rachunki','Śmieci','Paweł','Śmieci [udział 4/6 z 1 200,00 zł]'),
  ('00000000-0000-0000-0000-0000000000a3','11111111-1111-1111-1111-111111111111','2026-09-14','Wydatek',75.00,'Dzieci','Zajęcia','Paweł','Judo'),
  ('00000000-0000-0000-0000-0000000000b1','22222222-2222-2222-2222-222222222222','2026-09-14','Wydatek',10.00,'Inne','Inne','B',NULL);
