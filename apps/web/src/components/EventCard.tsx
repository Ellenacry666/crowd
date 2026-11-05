import { Link } from 'react-router-dom';
import type { EventItem } from '../api/types';
import { formatDateTime, formatRupiah } from '../utils/format';
import PosterImage from './PosterImage';

export default function EventCard({ event }: { event: EventItem }) {
  const soldOut =
    event.ticketCategories.length > 0 && event.ticketCategories.every((c) => c.available === 0);
  return (
    <Link
      to={`/events/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <PosterImage src={event.posterUrl} alt={event.title} className="h-44 w-full" />
      <div className="flex flex-1 flex-col p-4">
        <span className="mb-2 inline-block w-fit rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
          {event.category}
        </span>
        <h3 className="font-bold text-slate-900 group-hover:text-indigo-700">{event.title}</h3>
        <p className="mt-1 text-sm text-slate-500">{formatDateTime(event.startAt)}</p>
        <p className="text-sm text-slate-500">{event.location}</p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="font-semibold text-slate-900">
            {event.minPrice === null
              ? 'Belum ada tiket'
              : event.minPrice === 0
                ? 'Gratis'
                : `Mulai ${formatRupiah(event.minPrice)}`}
          </span>
          {soldOut && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              Habis
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
