import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceArea, ReferenceLine, ResponsiveContainer, Area, AreaChart, Tooltip, XAxis, YAxis } from 'recharts';
import { Icon } from '../components/Icon';
import { CHART } from '../lib/theme';
import { Alert, Card, GradCard, Empty, EventBadge, LevelBadge, levelLabel, MonitoringBadge, PhaseBadge, Spinner, Stat } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { ago, dateTime, num, timeOnly } from '../lib/format';
import { usePolling } from '../lib/usePolling';
import type { CheckInStats, Dashboard, EventItem, Paged } from '../lib/types';

const WINDOWS = [15, 60, 180, 360];
const AXIS = CHART.axis;
const GRID = CHART.grid;

function pickDefault(events: EventItem[]): string | null {
  const now = Date.now();
  const running = events.find((e) => e.status === 'PUBLISHED' && Date.parse(e.startAt) <= now && Date.parse(e.endAt) >= now);
  return (running ?? events.find((e) => e.status === 'PUBLISHED') ?? events[0])?.id ?? null;
}

export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [live, setLive] = useState(true);
  const [error, setError] = useState('');
  const eventId = params.get('event');
  const event = events?.find((e) => e.id === eventId) ?? null;

  useEffect(() => {
    api<Paged<EventItem>>('/admin/events?limit=100')
      .then((r) => {
        setEvents(r.items);
        if (!params.get('event')) {
          const id = pickDefault(r.items);
          if (id) setParams({ event: id }, { replace: true });
        }
      })
      .catch((e) => setError(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard Acara</h1>
          <p>Statistik tiket check-in dan hasil crowd monitoring kamera. Keduanya sumber data terpisah.</p>
        </div>
        <div className="row">
          <select aria-label="Pilih acara" value={eventId ?? ''} onChange={(e) => setParams({ event: e.target.value })} style={{ width: 260 }}>
            {!events && <option>Memuat…</option>}
            {events?.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <select aria-label="Rentang waktu" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} style={{ width: 130 }}>
            {WINDOWS.map((w) => <option key={w} value={w}>{w >= 60 ? `${w / 60} jam` : `${w} menit`} terakhir</option>)}
          </select>
          <label className="check" style={{ margin: 0 }}>
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Auto-refresh
          </label>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {events && events.length === 0 && (
        <Card><Empty>Belum ada acara. <Link to="/events/new">Buat acara pertama</Link>.</Empty></Card>
      )}

      {event && (
        <>
          <Card title={<span className="row">{event.title} <EventBadge status={event.status} /></span>}
            action={<Link className="btn secondary sm" to={`/events/${event.id}`}>Kelola kamera, lineup &amp; petugas</Link>}>
            <small>{event.location} · {dateTime(event.startAt)} – {dateTime(event.endAt)}</small>
          </Card>
          <div style={{ height: 16 }} />
          {/* Dua section dengan endpoint, state, dan error masing-masing: salah satu gagal/kosong tidak memengaruhi yang lain. */}
          <CheckInSection eventId={event.id} live={live} />
          <div style={{ height: 16 }} />
          <MonitoringSection eventId={event.id} minutes={minutes} live={live} />
        </>
      )}
    </>
  );
}

/** Sumber: status tiket (scan QR petugas). Tidak membaca data kamera. */
function CheckInSection({ eventId, live }: { eventId: string; live: boolean }) {
  const { data, error } = usePolling<CheckInStats>(`/admin/reports/events/${eventId}/checkin-stats`, live);
  if (error && !data) return <Card icon="ticket" title="Ticket Check-in"><Alert>Gagal memuat statistik tiket: {error}</Alert></Card>;
  if (!data) return <Card icon="ticket" title="Ticket Check-in"><Spinner /></Card>;
  return <CheckInStatsView s={data} />;
}

export function CheckInStatsView({ s }: { s: CheckInStats }) {
  return (
    <Card icon="ticket" title="Ticket Check-in Statistics"
      action={<small>{s.lastCheckInAt ? `Check-in terakhir ${timeOnly(s.lastCheckInAt)}` : 'Belum ada check-in'}</small>}>
      <div className="kpis">
        <GradCard tone="pink" icon="ticket" label="Total Tiket" value={num(s.issued)} foot="Diterbitkan" />
        <GradCard tone="blue" icon="check" label="Sudah Check-in" value={num(s.checkedIn)} foot={`${s.percentage}% dari total`} />
        <GradCard tone="teal" icon="clock" label="Belum Check-in" value={num(s.notCheckedIn)} foot="Menunggu dipindai" />
      </div>
      <div className="progress-head"><span>Persentase Check-in</span><b>{s.percentage}%</b></div>
      <div className="bar lg" role="progressbar" aria-label="Persentase check-in" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.percentage}>
        <i style={{ width: `${Math.min(100, s.percentage)}%` }} />
      </div>
      {s.issued === 0
        ? <small>Belum ada tiket yang diterbitkan untuk acara ini.</small>
        : <small>Dihitung dari tiket yang berhasil dipindai petugas gerbang (tiket sah, belum pernah dipakai){s.invalidTickets > 0 ? ` · ${num(s.invalidTickets)} tiket dibatalkan/kedaluwarsa termasuk dalam total` : ''}.</small>}
    </Card>
  );
}

/** Sumber: kamera gate & crowd. Tidak membaca tiket. */
function MonitoringSection({ eventId, minutes, live }: { eventId: string; minutes: number; live: boolean }) {
  const { data, error } = usePolling<Dashboard>(`/admin/events/${eventId}/crowd/dashboard?minutes=${minutes}`, live);
  if (error && !data) return <Card icon="activity" title="Crowd Monitoring"><Alert>Gagal memuat data monitoring: {error}</Alert></Card>;
  if (!data) return <Card icon="activity" title="Crowd Monitoring"><Spinner /></Card>;
  return (
    <>
      {error && <Alert tone="warn">Gagal memperbarui monitoring ({error}). Menampilkan data terakhir.</Alert>}
      <DashboardBody d={data} />
    </>
  );
}

export function DashboardBody({ d }: { d: Dashboard }) {
  const { gate, crowd } = d;
  const toMs = Date.parse(d.generatedAt);
  const fromMs = toMs - d.windowMinutes * 60_000;

  const crowdData = useMemo(() => crowd.series.map((p) => ({ ts: Date.parse(p.t), avg: p.avg, max: p.max })), [crowd.series]);
  const gateData = useMemo(() => gate.series.map((p) => ({ label: timeOnly(p.t), in: p.in, out: p.out })), [gate.series]);
  const areas = d.lineups.filter((l) => Date.parse(l.endAt) > fromMs && Date.parse(l.startAt) < toMs);

  const offline = d.cameras.filter((c) => c.status === 'OFFLINE');
  const noCameras = !gate.configured && !crowd.configured;
  const maxAvg = Math.max(1, ...d.lineups.map((l) => l.avgPeople ?? 0));
  const featured = d.currentLineup ?? d.nextLineup;

  return (
    <>
      {noCameras && <Alert tone="warn">Acara ini belum punya kamera. <Link to={`/events/${d.event.id}`}>Tambahkan kamera gate dan crowd</Link> untuk mulai memantau.</Alert>}
      {offline.map((c) => <Alert key={c.id} tone="warn">Kamera {c.type === 'GATE' ? 'gate' : 'crowd'} “{c.name}” tidak mengirim data sejak {ago(c.lastSeenAt)}. Angka di bawah mungkin sudah usang.</Alert>)}
      {crowd.level === 'CRITICAL' && <Alert tone="bad">Kepadatan KRITIS: {crowd.occupancyPct}% dari kapasitas area. Pertimbangkan membatasi masuk.</Alert>}
      {crowd.level === 'HIGH' && <Alert tone="warn">Kepadatan tinggi: {crowd.occupancyPct}% dari kapasitas area.</Alert>}

      <div className="grid two">
        <Card icon="log-in" title="Monitoring Kamera Gate — arus orang" action={<MonitoringBadge status={gate.status} />}>
          {!gate.configured ? <Empty>Kamera gate belum dikonfigurasi.</Empty> : gate.status === 'NOT_STARTED' ? (
            <Empty>Belum Ada Data Monitoring. Kamera gate belum mengirim data.</Empty>
          ) : (
            <>
              <div className="stats">
                <Stat label="Terdeteksi masuk" value={num(gate.totalIn)} hint="hitungan kamera" />
                <Stat label="Terdeteksi keluar" value={num(gate.totalOut)} hint="hitungan kamera" />
                <Stat label="Perkiraan di dalam" value={num(gate.insideNow)} hint="masuk − keluar" />
                <Stat label="Masuk 5 menit" value={num(gate.inLast5Min)} />
              </div>
              {gateData.length === 0 ? <Empty>Belum ada data pada rentang waktu ini.</Empty> : (
                <div role="img" aria-label="Grafik orang masuk dan keluar per interval" style={{ height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={gateData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" stroke={AXIS} fontSize={11} minTickGap={24} />
                      <YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="in" name="Masuk" fill={CHART.teal} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="out" name="Keluar" fill={CHART.orange} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <small>Update terakhir: {gate.lastSnapshotAt ? timeOnly(gate.lastSnapshotAt) : '–'} · hitungan kamera, bukan jumlah tiket ter-scan.</small>
            </>
          )}
        </Card>

        <Card icon="users" title="Monitoring Kamera Crowd — kepadatan area" action={<MonitoringBadge status={crowd.status} />}>
          {!crowd.configured ? <Empty>Kamera crowd belum dikonfigurasi.</Empty> : crowd.status === 'NOT_STARTED' ? (
            <Empty>Belum Ada Data Monitoring. Kamera crowd belum mengirim data.</Empty>
          ) : (
            <>
              <div className="stats">
                <Stat label="Orang saat ini" value={num(crowd.current)} hint={crowd.lastSnapshotAt ? `data ${ago(crowd.lastSnapshotAt)}` : 'belum ada data'}
                  tone={crowd.level === 'CRITICAL' ? 'bad' : crowd.level === 'HIGH' ? 'warn' : undefined} />
                <Stat label="Okupansi" value={crowd.occupancyPct === null ? '–' : `${crowd.occupancyPct}%`}
                  hint={<><LevelBadge level={crowd.level} />{crowd.capacity ? ` kap. ${num(crowd.capacity)}` : ''}</>} />
                <Stat label="Rata-rata" value={num(crowd.avg)} hint="pada rentang ini" />
                <Stat label="Puncak" value={num(crowd.peak)} hint="pada rentang ini" />
              </div>
              {crowdData.length === 0 ? <Empty>Belum ada data pada rentang waktu ini.</Empty> : (
                <div role="img" aria-label="Grafik jumlah orang di area crowd dengan penanda jadwal penampil" style={{ height: 240 }}>
                  <ResponsiveContainer>
                    <AreaChart data={crowdData} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="ts" type="number" scale="time" domain={[fromMs, toMs]} tickFormatter={(v) => timeOnly(v)} stroke={AXIS} fontSize={11} tickCount={6} />
                      <YAxis stroke={AXIS} fontSize={11} allowDecimals={false} domain={[0, (max: number) => Math.ceil(Math.max(max, crowd.capacity ?? 0) * 1.1)]} />
                      <Tooltip labelFormatter={(v) => timeOnly(Number(v))} />
                      {areas.map((l) => (
                        <ReferenceArea key={l.id} x1={Math.max(Date.parse(l.startAt), fromMs)} x2={Math.min(Date.parse(l.endAt), toMs)}
                          fill={l.isGuestStar ? CHART.pink : CHART.brand} fillOpacity={l.isGuestStar ? 0.2 : 0.12} stroke="none"
                          label={{ value: l.artistName, position: 'insideTop', fontSize: 11, fill: AXIS }} />
                      ))}
                      {crowd.capacity && <ReferenceLine y={crowd.capacity} stroke={CHART.danger} strokeDasharray="5 4" label={{ value: 'Kapasitas', fill: CHART.danger, fontSize: 11, position: 'insideTopLeft' }} />}
                      <Area type="monotone" dataKey="avg" name="Rata-rata orang" stroke={CHART.brand} fill={CHART.brand} fillOpacity={0.25} isAnimationActive={false} />
                      <Area type="monotone" dataKey="max" name="Puncak interval" stroke={CHART.brandSoft} fill="none" strokeDasharray="3 3" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <small>Update terakhir: {crowd.lastSnapshotAt ? timeOnly(crowd.lastSnapshotAt) : '–'} · Area kuning = guest star tampil, area ungu = penampil lain.</small>
            </>
          )}
        </Card>
      </div>

      <div style={{ height: 16 }} />
      <Card icon="mic" title="Kerumunan per penampil (kamera crowd)" action={<Link className="btn secondary sm" to={`/events/${d.event.id}`}>Atur lineup</Link>}>
        {featured && (
          <div className="now-playing">
            <div>
              <small>{d.currentLineup ? 'Sedang tampil' : 'Selanjutnya'}</small>
              <h3>{featured.isGuestStar && <Icon name="star" size={16} className="star" />}{featured.artistName}</h3>
              <small>{timeOnly(featured.startAt)} – {timeOnly(featured.endAt)}</small>
            </div>
            {d.currentLineup && (
              <div className="row">
                <Stat label="Orang sekarang" value={num(crowd.current)} />
                <Stat label="Rata-rata tampil" value={num(featured.avgPeople)} />
                <Stat label="Puncak tampil" value={num(featured.peakPeople)} />
              </div>
            )}
          </div>
        )}
        {d.lineups.length === 0 ? <Empty>Belum ada lineup. <Link to={`/events/${d.event.id}`}>Tambahkan lineup</Link>.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Penampil</th><th>Jadwal</th><th>Status</th><th className="num">Rata-rata</th><th className="num">Puncak</th>
                  <th className="num" title="Dibanding rata-rata 15 menit sebelum tampil">Kenaikan</th><th>Perbandingan</th></tr>
              </thead>
              <tbody>
                {d.lineups.map((l) => (
                  <tr key={l.id} className={l.phase === 'LIVE' ? 'live' : ''}>
                    <td><b>{l.isGuestStar && <Icon name="star" size={14} className="star" />}{l.artistName}</b></td>
                    <td>{timeOnly(l.startAt)} – {timeOnly(l.endAt)}</td>
                    <td><PhaseBadge phase={l.phase} /></td>
                    <td className="num">{num(l.avgPeople)}</td>
                    <td className="num">{num(l.peakPeople)}</td>
                    <td className="num">
                      {l.upliftPct === null ? '–' : <span className={l.upliftPct >= 0 ? 'up' : 'down'}>{l.upliftPct > 0 ? '+' : ''}{l.upliftPct}%</span>}
                    </td>
                    <td style={{ width: 140 }}>{l.avgPeople !== null && <div className="bar"><i style={{ width: `${(l.avgPeople / maxAvg) * 100}%` }} /></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <small>Kenaikan = rata-rata saat tampil dibanding 15 menit sebelumnya. Penampil yang belum tampil belum punya data.{crowd.level && ` Level saat ini: ${levelLabel(crowd.level)}.`}</small>
      </Card>
    </>
  );
}
