-- Cofa 20261025100100_reguly_rozpoznawania.sql (#133).
-- KASUJE DANE: reguły zapisane w bazie. Front sprzed #133 czyta reguły
-- z localStorage — po rollbacku trzeba je dodać ponownie.
DROP TABLE IF EXISTS public.reguly_rozpoznawania;
