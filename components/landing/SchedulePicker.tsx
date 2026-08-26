'use client';

/* Adapted from the Calendar appointment picker: month grid on the left,
   post times on the right. Uses your shadcn primitives.

   Version note: this deliberately uses only props that exist in BOTH
   react-day-picker v8 and v9+ — `disabled` in its function form, plus
   `modifiers` / `modifiersClassNames`. The v8 prop `fromMonth` was
   renamed `startMonth` in v9, so it is avoided entirely; past dates are
   blocked by `disabled` instead, which works either way. */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';

const TIMES = ['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
               '01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM',
               '04:00 PM','04:30 PM'];

/** days of the month that already hold a scheduled post */
const BUSY_DAYS = [4, 9, 14, 18, 23, 28];

const BUSY_DOT =
  'relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 ' +
  'after:-translate-x-1/2 after:rounded-full after:bg-[#6b6965]';

export default function SchedulePicker() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [date, setDate] = useState<Date | undefined>(today);
  const [time, setTime] = useState<string | null>(null);

  const busy = useMemo(
    () => BUSY_DAYS.map(d => new Date(today.getFullYear(), today.getMonth(), d)),
    [today],
  );

  const pretty = date?.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="w-[min(96%,432px)] overflow-hidden rounded-[14px] bg-white shadow-[inset_0_0_0_1.5px_#e8e5e0]">
      <div className="flex">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={(d: Date) => d < today}
          modifiers={{ busy }}
          modifiersClassNames={{ busy: BUSY_DOT }}
          className="flex-1 p-3"
        />
        <div className="flex w-[126px] shrink-0 flex-col border-l border-[#e8e5e0]">
          <p className="px-2.5 pb-2 pt-3 text-center text-[.76rem] font-semibold">Post times</p>
          <ScrollArea className="max-h-[170px] flex-1">
            <div className="grid gap-1.5 px-2.5 pb-3">
              {TIMES.map(t => (
                <Button
                  key={t}
                  size="sm"
                  variant={time === t ? 'default' : 'outline'}
                  onClick={() => setTime(t)}
                  className="h-auto py-1.5 text-[.74rem]"
                >
                  {t}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
      <p role="status" className="border-t border-[#e8e5e0] bg-[#f7f5f2] px-3 py-2.5 text-[.76rem] leading-snug text-[#6b6965]">
        {time
          ? <>Queued for <b className="font-semibold text-[#121212]">{pretty} at {time}</b> on Shorts, TikTok and Reels.</>
          : <>Approved clips post on <b className="font-semibold text-[#121212]">{pretty}</b>. Pick a time.</>}
      </p>
    </div>
  );
}
