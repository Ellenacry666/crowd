import { ticketsApi } from '../api/endpoints';
import { useBlobUrl } from '../utils/hooks';

/** Foto pemegang tiket (diambil lewat endpoint terautentikasi, bukan URL publik). */
export default function HolderThumb({
  ticketId,
  sizeClass = 'h-16 w-16',
  alt = 'Foto pemegang tiket',
}: {
  ticketId: string;
  sizeClass?: string;
  alt?: string;
}) {
  const { url, failed } = useBlobUrl(() => ticketsApi.photo(ticketId), [ticketId]);
  if (url) {
    return <img src={url} alt={alt} className={`${sizeClass} rounded-lg border border-slate-200 object-cover`} />;
  }
  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-lg bg-slate-100 text-center text-[10px] text-slate-400`}
    >
      {failed ? 'Foto tidak tersedia' : '...'}
    </div>
  );
}
