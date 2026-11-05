import { QRCodeSVG } from 'qrcode.react';
import type { Ticket } from '../api/types';
import { formatDateTime } from '../utils/format';
import HolderThumb from './HolderThumb';
import { StatusBadge } from './ui';

export default function TicketCard({ ticket }: { ticket: Ticket }) {
  const usable = ticket.status === 'ACTIVE';
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
        <p className="text-xs uppercase tracking-wide text-indigo-100">{ticket.categoryName}</p>
        <h3 className="text-lg font-bold leading-tight">{ticket.event.title}</h3>
      </div>

      <div className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          {ticket.qrPayload ? (
            <div className={`rounded-lg border border-slate-200 bg-white p-3 ${usable ? '' : 'opacity-30'}`}>
              <QRCodeSVG
                value={ticket.qrPayload}
                size={176}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
                role="img"
                aria-label={`QR Code tiket ${ticket.ticketCode}`}
              />
            </div>
          ) : (
            <div className="flex h-[200px] w-[200px] items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
              QR tidak tersedia
            </div>
          )}
          {!usable && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="-rotate-12 rounded border-2 border-slate-700 bg-white/90 px-3 py-1 text-sm font-extrabold uppercase text-slate-700">
                {ticket.status === 'USED' ? 'Sudah digunakan' : 'Tidak berlaku'}
              </span>
            </div>
          )}
        </div>

        <dl className="w-full space-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase text-slate-400">Kode tiket</dt>
            <dd className="break-all font-mono text-xs font-semibold text-slate-900">{ticket.ticketCode}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Tanggal</dt>
            <dd>{formatDateTime(ticket.event.startAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Lokasi</dt>
            <dd>{ticket.event.location}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">No. order</dt>
            <dd className="font-mono text-xs">{ticket.orderNumber}</dd>
          </div>
          {ticket.hasHolderPhoto && (
            <div>
              <dt className="mb-1 text-xs uppercase text-slate-400">Pemegang tiket</dt>
              <dd>
                <HolderThumb ticketId={ticket.id} />
              </dd>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <StatusBadge status={ticket.paymentStatus} />
            <StatusBadge status={ticket.status} />
          </div>
          {ticket.checkedInAt && (
            <p className="text-xs text-slate-500">Check-in: {formatDateTime(ticket.checkedInAt)}</p>
          )}
        </dl>
      </div>
    </article>
  );
}
