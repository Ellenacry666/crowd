import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardPage, { CheckInStatsView, DashboardBody } from './pages/DashboardPage';
import { mockApi } from './test-utils';
import type { CheckInStats, Dashboard, LineupAnalytics } from './lib/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

// Recharts butuh ukuran container nyata; jsdom tidak punya layout.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const now = Date.now();
const iso = (m: number) => new Date(now + m * 60_000).toISOString();

const lineup = (o: Partial<LineupAnalytics>): LineupAnalytics => ({
  id: 'l', eventId: 'e', artistName: 'X', isGuestStar: false, startAt: iso(-10), endAt: iso(10), notes: null,
  phase: 'DONE', avgPeople: null, peakPeople: null, baselineAvg: null, upliftPct: null, samples: 0, ...o,
});

const base = (): Dashboard => ({
  generatedAt: iso(0), windowMinutes: 60, bucketSeconds: 60,
  event: { id: 'e', title: 'Konser Uji', location: 'Bandung', startAt: iso(-150), endAt: iso(150), status: 'PUBLISHED' },
  cameras: [
    { id: 'g', eventId: 'e', type: 'GATE', name: 'Gate', streamUrl: null, capacity: null, isActive: true, lastSeenAt: iso(0), status: 'ONLINE' },
    { id: 'c', eventId: 'e', type: 'CROWD', name: 'Crowd', streamUrl: null, capacity: 1500, isActive: true, lastSeenAt: iso(-5), status: 'OFFLINE' },
  ],
  gate: { configured: true, status: 'ACTIVE', lastSnapshotAt: iso(0), totalIn: 1234, totalOut: 200, insideNow: 1034, inLast5Min: 55,
    series: [{ t: iso(-2), in: 10, out: 1 }] },
  crowd: { configured: true, status: 'INACTIVE', current: 1400, lastSnapshotAt: iso(-5), density: null, avg: 900, peak: 1450, capacity: 1500, occupancyPct: 93.3, level: 'CRITICAL',
    series: [{ t: iso(-2), avg: 1000, max: 1100 }] },
  lineups: [
    lineup({ id: '1', artistName: 'Band Pembuka', phase: 'DONE', avgPeople: 500, peakPeople: 600, upliftPct: null }),
    lineup({ id: '2', artistName: 'Bintang Tamu', isGuestStar: true, phase: 'LIVE', avgPeople: 1200, peakPeople: 1450, baselineAvg: 800, upliftPct: 50 }),
    lineup({ id: '3', artistName: 'DJ Penutup', phase: 'UPCOMING', startAt: iso(70), endAt: iso(130) }),
  ],
  currentLineup: lineup({ id: '2', artistName: 'Bintang Tamu', isGuestStar: true, phase: 'LIVE', avgPeople: 1200, peakPeople: 1450 }),
  nextLineup: null,
});

const view = (d: Dashboard) => render(<MemoryRouter><DashboardBody d={d} /></MemoryRouter>);

describe('DashboardBody', () => {
  it('menampilkan KPI gate, crowd, level kritis, dan peringatan kamera offline', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    view(base());
    expect(screen.getByText(/1\.234/)).toBeTruthy(); // total masuk (format id-ID)
    expect(screen.getByText('93.3%')).toBeTruthy();
    expect(screen.getByText('Tidak Aktif')).toBeTruthy();
    // Kartu monitoring tidak boleh memuat angka tiket.
    expect(screen.queryByText(/Check-in/i)).toBeNull();
    expect(screen.getByText(/Kepadatan KRITIS/)).toBeTruthy();
    expect(screen.getByText(/tidak mengirim data/)).toBeTruthy();
  });

  it('menampilkan analisis per penampil dengan kenaikan dan guest star', () => {
    view(base());
    expect(screen.getAllByText(/Bintang Tamu/).length).toBeGreaterThan(0);
    expect(screen.getByText('+50%')).toBeTruthy();
    expect(screen.getByText('Sedang tampil', { selector: '.badge' })).toBeTruthy();
    // Penampil yang belum tampil tidak punya metrik palsu.
    const row = screen.getByText('DJ Penutup').closest('tr')!;
    expect(row.textContent).toContain('–');
  });

  it('menangani acara tanpa kamera dan tanpa lineup', () => {
    const d = base();
    d.cameras = [];
    d.gate = { ...d.gate, configured: false, status: 'NOT_STARTED' };
    d.crowd = { ...d.crowd, configured: false, status: 'NOT_STARTED', current: null, level: null, occupancyPct: null, series: [] };
    d.lineups = []; d.currentLineup = null;
    view(d);
    expect(screen.getByText(/belum punya kamera/)).toBeTruthy();
    expect(screen.getByText(/Belum ada lineup/)).toBeTruthy();
  });
});

describe('Empty state monitoring', () => {
  it('kamera sudah dikonfigurasi tetapi belum mengirim data: "Belum Ada Data Monitoring", bukan angka 0', () => {
    const d = base();
    d.gate = { ...d.gate, status: 'NOT_STARTED', lastSnapshotAt: null, totalIn: 0, totalOut: 0, series: [] };
    d.crowd = { ...d.crowd, status: 'NOT_STARTED', current: null, lastSnapshotAt: null, avg: null, peak: null, occupancyPct: null, level: null, series: [] };
    d.cameras = d.cameras.map((c) => ({ ...c, status: 'NEVER' as const, lastSeenAt: null }));
    view(d);
    expect(screen.getAllByText(/Belum Ada Data Monitoring/).length).toBe(2);
    expect(screen.getAllByText('Belum Dimulai').length).toBe(2);
  });
});

const stats = (o: Partial<CheckInStats> = {}): CheckInStats => ({
  eventId: 'ev', issued: 10, checkedIn: 3, notCheckedIn: 7, percentage: 30, invalidTickets: 0, lastCheckInAt: null, generatedAt: iso(0), ...o,
});

describe('CheckInStatsView', () => {
  it('menampilkan total, sudah, belum, dan persentase', () => {
    render(<CheckInStatsView s={stats()} />);
    expect(screen.getByText('Total Tiket')).toBeTruthy();
    expect(screen.getByText('30%')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('belum ada tiket: 0 dan 0% (tanpa NaN)', () => {
    render(<CheckInStatsView s={stats({ issued: 0, checkedIn: 0, notCheckedIn: 0, percentage: 0 })} />);
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByText(/Belum ada tiket yang diterbitkan/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
  });
});

describe('DashboardPage — dua sumber data independen', () => {
  const eventsRoute = {
    'GET /admin/events?limit=100': () => ({
      body: { items: [{ id: 'ev', title: 'Konser Uji', location: 'Bandung', startAt: iso(-60), endAt: iso(60), status: 'PUBLISHED' }], meta: {} },
    }),
  };
  const open = () => render(<MemoryRouter initialEntries={['/dashboard?event=ev']}><DashboardPage /></MemoryRouter>);

  it('monitoring error 500: statistik tiket tetap tampil', async () => {
    mockApi({
      ...eventsRoute,
      'GET /admin/reports/events/ev/checkin-stats': () => ({ body: stats({ checkedIn: 2, notCheckedIn: 8, percentage: 20 }) }),
      'GET /admin/events/ev/crowd/dashboard': () => ({ status: 500, body: { message: 'monitoring rusak' } }),
    });
    open();
    expect(await screen.findByText('20%')).toBeTruthy();
    expect(await screen.findByText(/Gagal memuat data monitoring/)).toBeTruthy();
  });

  it('statistik tiket error 500: monitoring tetap tampil', async () => {
    mockApi({
      ...eventsRoute,
      'GET /admin/reports/events/ev/checkin-stats': () => ({ status: 500, body: { message: 'tiket rusak' } }),
      'GET /admin/events/ev/crowd/dashboard': () => ({ body: base() }),
    });
    open();
    expect(await screen.findByText(/Gagal memuat statistik tiket/)).toBeTruthy();
    expect(await screen.findByText('93.3%')).toBeTruthy();
  });

  it('monitoring belum ada data: kartu tiket menampilkan statistik, kartu monitoring menampilkan empty state', async () => {
    const d = base();
    d.gate = { ...d.gate, status: 'NOT_STARTED', lastSnapshotAt: null, series: [] };
    d.crowd = { ...d.crowd, status: 'NOT_STARTED', current: null, lastSnapshotAt: null, level: null, occupancyPct: null, series: [] };
    d.cameras = [];
    mockApi({
      ...eventsRoute,
      'GET /admin/reports/events/ev/checkin-stats': () => ({ body: stats({ issued: 5, checkedIn: 2, notCheckedIn: 3, percentage: 40 }) }),
      'GET /admin/events/ev/crowd/dashboard': () => ({ body: d }),
    });
    open();
    expect(await screen.findByText('40%')).toBeTruthy();
    expect(await screen.findAllByText(/Belum Dimulai|Kamera .* belum dikonfigurasi/)).not.toHaveLength(0);
  });

  it('endpoint statistik tiket tidak memakai endpoint crowd, dan sebaliknya', async () => {
    const { calls } = mockApi({
      ...eventsRoute,
      'GET /admin/reports/events/ev/checkin-stats': () => ({ body: stats() }),
      'GET /admin/events/ev/crowd/dashboard': () => ({ body: base() }),
    });
    open();
    await screen.findByText('30%');
    await screen.findByText('93.3%');
    const keys = calls.map((c) => c.key);
    expect(keys.some((k) => k.includes('/checkin-stats'))).toBe(true);
    expect(keys.some((k) => k.includes('/crowd/dashboard'))).toBe(true);
  });
});
