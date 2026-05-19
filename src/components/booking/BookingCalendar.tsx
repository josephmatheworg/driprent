import { useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, differenceInDays, eachDayOfInterval, isSameDay, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface BookingCalendarProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  bookedDates?: Date[];
  minDate?: Date;
  persistKey?: string;
  numberOfMonths?: number;
}

/**
 * Premium Airbnb-style booking calendar.
 * - Click 1: sets start (green)
 * - Click 2: sets end (red). If before start, becomes new start.
 * - Same-day click = 1 Day Rental.
 * - Booked dates disabled with strikethrough.
 * - Persists selection in sessionStorage when persistKey provided.
 */
export function BookingCalendar({
  value,
  onChange,
  bookedDates = [],
  minDate,
  persistKey,
  numberOfMonths = 1,
}: BookingCalendarProps) {
  const today = startOfDay(new Date());
  const floor = minDate ?? today;

  // Hydrate from sessionStorage
  useEffect(() => {
    if (!persistKey || value?.from) return;
    try {
      const raw = sessionStorage.getItem(`booking-dates:${persistKey}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const from = parsed.from ? new Date(parsed.from) : undefined;
      const to = parsed.to ? new Date(parsed.to) : undefined;
      if (from && from >= floor) onChange({ from, to: to && to >= from ? to : from });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  // Persist on change
  useEffect(() => {
    if (!persistKey) return;
    if (value?.from) {
      sessionStorage.setItem(
        `booking-dates:${persistKey}`,
        JSON.stringify({
          from: value.from.toISOString(),
          to: value.to?.toISOString() ?? value.from.toISOString(),
        })
      );
    } else {
      sessionStorage.removeItem(`booking-dates:${persistKey}`);
    }
  }, [value?.from, value?.to, persistKey]);

  const isBooked = (date: Date) => bookedDates.some((d) => isSameDay(d, date));

  const handleDayClick = (day: Date) => {
    if (isBooked(day) || day < floor) return;

    // No selection yet OR full range exists → start fresh
    if (!value?.from || (value.from && value.to && !isSameDay(value.from, value.to))) {
      onChange({ from: day, to: day });
      return;
    }

    // Have a from, no proper to → set end
    const from = value.from;
    if (day < from) {
      onChange({ from: day, to: day });
      return;
    }

    // Validate no booked dates in between
    const range = eachDayOfInterval({ start: from, end: day });
    if (range.some((d) => isBooked(d))) {
      onChange({ from: day, to: day });
      return;
    }

    onChange({ from, to: day });
  };

  const middleDates = useMemo(() => {
    if (!value?.from || !value?.to) return [];
    if (isSameDay(value.from, value.to)) return [];
    const all = eachDayOfInterval({ start: value.from, end: value.to });
    return all.slice(1, -1);
  }, [value?.from, value?.to]);

  const days = value?.from && value?.to ? differenceInDays(value.to, value.from) + 1 : 0;
  const isSingleDay = days === 1;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto -mx-2 px-2">
        <Calendar
          mode="single"
          selected={undefined}
          onDayClick={handleDayClick}
          disabled={(date) => date < floor || isBooked(date)}
          numberOfMonths={numberOfMonths}
          modifiers={{
            booked: bookedDates,
            rangeStart: value?.from ? [value.from] : [],
            rangeEnd: value?.to && !isSameDay(value.from!, value.to) ? [value.to] : [],
            rangeMiddle: middleDates,
          }}
          modifiersClassNames={{
            booked:
              'bg-destructive/10 text-destructive/60 line-through pointer-events-none opacity-60',
            rangeStart:
              'bg-emerald-600 text-white font-semibold rounded-full hover:bg-emerald-600 ring-2 ring-emerald-300 shadow-md transition-all',
            rangeEnd:
              'bg-rose-600 text-white font-semibold rounded-full hover:bg-rose-600 ring-2 ring-rose-300 shadow-md transition-all',
            rangeMiddle:
              'bg-emerald-100/70 dark:bg-emerald-900/30 text-foreground rounded-none transition-colors',
          }}
          className={cn('rounded-xl border bg-background pointer-events-auto mx-auto')}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-600" /> Start
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-rose-600" /> End
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300" />{' '}
          In range
        </span>
        {bookedDates.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-destructive/30 line-through" /> Booked
          </span>
        )}
      </div>

      {/* Summary */}
      {value?.from && (
        <div className="rounded-xl border border-border bg-card/50 p-4 animate-fade-in">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Start</p>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                {format(value.from, 'MMM d')}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">End</p>
              <p className="font-semibold text-rose-700 dark:text-rose-400">
                {value.to ? format(value.to, 'MMM d') : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration</p>
              <p className="font-semibold">
                {isSingleDay ? '1 Day Rental' : `${days} Days`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
