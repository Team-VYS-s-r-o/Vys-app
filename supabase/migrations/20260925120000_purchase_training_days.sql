-- Volba tréninkových dnů u nákupu kroužku (např. Úterý, Čtvrtek, nebo oba).
-- NULL = kroužek má jen jeden tréninkový den (volba se nenabízí).
alter table public.parent_purchases
  add column if not exists training_days text[];

-- Stávající přihlášky na Brandýs (Út/Čt) chodí na oba dny.
update public.parent_purchases
   set training_days = array['Úterý', 'Čtvrtek']
 where product_id in ('course-brandys-vysluni', 'course-brandys-vysluni-15')
   and training_days is null;
