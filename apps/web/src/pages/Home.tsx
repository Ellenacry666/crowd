import { Link } from 'react-router-dom';
import { eventsApi } from '../api/endpoints';
import EventCard from '../components/EventCard';
import { AsyncView, EmptyState } from '../components/ui';
import { useAsync } from '../utils/hooks';

const features = [
  { title: 'Tiket digital dengan QR', text: 'Setiap tiket punya QR Code unik yang ditandatangani server dan tidak berisi data pribadi.' },
  { title: 'Validasi masuk yang aman', text: 'Petugas memindai QR dengan aplikasi Android. Satu tiket hanya dapat dipakai satu kali.' },
  { title: 'Stok selalu akurat', text: 'Kuota dicadangkan saat order dibuat, sehingga tiket tidak terjual melebihi kapasitas.' },
];

export default function Home() {
  const { data, loading, error, reload } = useAsync(() => eventsApi.list({ limit: 3 }), []);

  return (
    <div className="space-y-14">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-14 text-center text-white shadow-lg md:px-12 md:py-20">
        <h1 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">
          Tiket acara digital dengan validasi QR Code
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-indigo-100">
          Temukan acara, pilih tiket, dan masuk gerbang dengan sekali pindai. Platform capstone CrowdPulse.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/events" className="rounded-lg bg-white px-6 py-3 text-sm font-bold text-indigo-700 shadow hover:bg-indigo-50">
            Lihat semua acara
          </Link>
          <Link to="/register" className="rounded-lg border border-white/60 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
            Buat akun
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-xl font-bold">Acara terdekat</h2>
          <Link to="/events" className="text-sm font-semibold text-indigo-600 hover:underline">
            Lihat semua
          </Link>
        </div>
        <AsyncView loading={loading} error={error} onRetry={reload}>
          {data && data.items.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <EmptyState title="Belum ada acara yang tersedia">Silakan kembali lagi nanti.</EmptyState>
          )}
        </AsyncView>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
