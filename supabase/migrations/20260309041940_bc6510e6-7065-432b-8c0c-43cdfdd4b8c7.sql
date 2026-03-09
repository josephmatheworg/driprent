-- Public table that exposes only booked date ranges (no user info)
create table if not exists public.fit_booked_ranges (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null unique references public.rentals(id) on delete cascade,
  fit_id uuid not null references public.fits(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fit_booked_ranges enable row level security;

-- Anyone can read booked ranges (needed for availability calendar)
create policy "Booked ranges are viewable by everyone"
on public.fit_booked_ranges
for select
using (true);

-- Keep updated_at fresh
drop trigger if exists fit_booked_ranges_set_updated_at on public.fit_booked_ranges;
create trigger fit_booked_ranges_set_updated_at
before update on public.fit_booked_ranges
for each row
execute function public.update_updated_at_column();

-- Sync helper: insert/update/delete the public ranges based on rentals status
create or replace function public.sync_fit_booked_ranges_from_rentals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- DELETE: remove any mirrored block row
  if (tg_op = 'DELETE') then
    perform set_config('row_security', 'off', true);
    delete from public.fit_booked_ranges where rental_id = old.id;
    return old;
  end if;

  -- INSERT/UPDATE
  if (new.status in ('confirmed'::public.rental_status, 'active'::public.rental_status)) then
    perform set_config('row_security', 'off', true);
    insert into public.fit_booked_ranges (rental_id, fit_id, start_date, end_date)
    values (new.id, new.fit_id, new.start_date, new.end_date)
    on conflict (rental_id)
    do update set
      fit_id = excluded.fit_id,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      updated_at = now();
  else
    -- Not blocking status anymore => remove mirror row if it exists
    perform set_config('row_security', 'off', true);
    delete from public.fit_booked_ranges where rental_id = new.id;
  end if;

  return new;
end;
$$;

-- Triggers to keep fit_booked_ranges in sync
drop trigger if exists rentals_sync_fit_booked_ranges_ins on public.rentals;
drop trigger if exists rentals_sync_fit_booked_ranges_upd on public.rentals;
drop trigger if exists rentals_sync_fit_booked_ranges_del on public.rentals;

create trigger rentals_sync_fit_booked_ranges_ins
after insert on public.rentals
for each row
execute function public.sync_fit_booked_ranges_from_rentals();

create trigger rentals_sync_fit_booked_ranges_upd
after update of status, start_date, end_date, fit_id on public.rentals
for each row
execute function public.sync_fit_booked_ranges_from_rentals();

create trigger rentals_sync_fit_booked_ranges_del
after delete on public.rentals
for each row
execute function public.sync_fit_booked_ranges_from_rentals();

-- Enable realtime on the public table so other users instantly see new booked dates
alter publication supabase_realtime add table public.fit_booked_ranges;