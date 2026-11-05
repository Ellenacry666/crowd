import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { eventsApi } from '../api/endpoints';
import EventCard from '../components/EventCard';
import { AsyncView, Button, EmptyState, inputClass, PageHeader, Pagination } from '../components/ui';
import { useAsync, useDebounce } from '../utils/hooks';

export const CATEGORY_SUGGESTIONS = ['Music', 'Education', 'Exhibition', 'Sports', 'Festival', 'Seminar'];

export default function Events() {
  const [params, setParams] = useSearchParams();
  const urlSearch = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const dateFrom = params.get('dateFrom') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;

  const [searchInput, setSearchInput] = useState(urlSearch);
  const debounced = useDebounce(searchInput, 400);

  const update = (changes: Record<string, string>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };

  // Sinkronkan kotak pencarian (dengan jeda) ke URL.
  useEffect(() => {
    if (debounced !== urlSearch) update({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const { data, loading, error, reload } = useAsync(
    () =>
      eventsApi.list({
        search: urlSearch,
        category,
        // Tanggal dari input type=date (YYYY-MM-DD) diterima backend sebagai awal hari UTC.
        dateFrom: dateFrom || undefined,
        page,
        limit: 9,
      }),
    [urlSearch, category, dateFrom, page],
  );

  const hasFilter = Boolean(urlSearch || category || dateFrom);

  return (
    <div>
      <PageHeader title="Acara" subtitle="Temukan acara dan pilih tiket Anda." />

      <div className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <input
          type="search"
          className={`${inputClass} md:col-span-2`}
          placeholder="Cari nama acara atau lokasi..."
          aria-label="Cari acara"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <div>
          <input
            list="category-suggestions"
            className={inputClass}
            placeholder="Kategori"
            aria-label="Filter kategori"
            value={category}
            onChange={(e) => update({ category: e.target.value })}
          />
          <datalist id="category-suggestions">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <input
          type="date"
          className={inputClass}
          aria-label="Mulai dari tanggal"
          value={dateFrom}
          onChange={(e) => update({ dateFrom: e.target.value })}
        />
        {hasFilter && (
          <div className="md:col-span-4">
            <Button
              variant="ghost"
              onClick={() => {
                setSearchInput('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              Hapus semua filter
            </Button>
          </div>
        )}
      </div>

      <AsyncView loading={loading} error={error} onRetry={reload}>
        {data && data.items.length > 0 ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
            <Pagination meta={data.meta} onChange={(p) => update({ page: String(p) }, false)} />
          </>
        ) : (
          <EmptyState title="Acara tidak ditemukan">
            {hasFilter ? 'Coba ubah atau hapus filter pencarian.' : 'Belum ada acara yang tersedia.'}
          </EmptyState>
        )}
      </AsyncView>
    </div>
  );
}
