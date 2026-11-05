import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './components/toast';
import SalesPage from './pages/SalesPage';
import { mockApi } from './test-utils';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const sale = (o: Record<string, unknown>) => ({
  ticketCategoryId: 'c1', eventId: 'ev1', eventTitle: 'Konser A', name: 'Reguler', price: 100000, quota: 100,
  soldCount: 40, reservedCount: 10, available: 50, ticketsPaid: 40, simulatedRevenue: 4_000_000, ...o,
});
const order = (i: number, status = 'PAID') => ({
  id: `o${i}`, orderNumber: `ORD-${i}`, status, totalAmount: 200000, createdAt: '2026-11-02T09:00:00Z',
  event: { id: 'ev1', title: 'Konser A' }, items: [{ ticketCategoryId: 'c1', categoryName: 'Reguler', quantity: 2, unitPrice: 100000, subtotal: 200000 }],
  user: { id: 'u1', name: `Pembeli ${i}`, email: `p${i}@x.id` },
});

function setup(over: Record<string, any> = {}) {
  const api = mockApi({
    'GET /admin/events?limit=100': () => ({ body: { items: [
      { id: 'ev1', title: 'Konser A', status: 'PUBLISHED' }, { id: 'ev2', title: 'Konser B', status: 'PUBLISHED' }], meta: {} } }),
    'GET /admin/reports/sales': () => ({ body: [
      sale({}),
      sale({ ticketCategoryId: 'c2', name: 'VIP', price: 300000, quota: 20, soldCount: 20, reservedCount: 0, available: 0, ticketsPaid: 20, simulatedRevenue: 6_000_000 }),
    ] }),
    'GET /admin/reports/summary': () => ({ body: { orders: { total: 12, byStatus: { PAID: 8, PENDING: 3, EXPIRED: 1 } }, simulatedRevenue: 10_000_000 } }),
    'GET /admin/orders': () => ({ body: { items: [order(1), order(2, 'PENDING')], meta: { page: 1, limit: 10, total: 25, totalPages: 3 } } }),
    'PATCH /admin/ticket-categories/c1': ({ body }) => ({ body }),
    'DELETE /admin/ticket-categories/c2': () => ({ status: 409, body: { message: 'Kategori sudah dipakai di order dan tidak dapat dihapus' } }),
    'POST /admin/events/ev2/ticket-categories': ({ body }) => ({ status: 201, body }),
    ...over,
  });
  render(<MemoryRouter><ToastProvider><SalesPage /></ToastProvider></MemoryRouter>);
  return api;
}
const call = (calls: Array<{ key: string; body: any }>, prefix: string) => calls.filter((c) => c.key.startsWith(prefix));
const rowOf = async (text: string) => (await screen.findByText(text)).closest('tr') as HTMLElement;

describe('Penjualan tiket', () => {
  it('KPI dihitung dari baris kategori: pendapatan, terjual vs kuota, tersedia, tertahan', async () => {
    setup();
    await screen.findByText('50% dari kuota 120'); // terjual 40 + 20 = 60 dari kuota 100 + 20 = 120
    const kpi = (tone: string) => document.querySelector(`.kpi.${tone}`)!.textContent ?? '';
    expect(kpi('pink')).toContain('Rp10.000.000'); // 4 jt + 6 jt
    expect(kpi('blue')).toContain('60');
    expect(kpi('teal')).toContain('50'); // tersedia 50 + 0
    expect(screen.getByText('10 tertahan order menunggu')).toBeTruthy();
  });

  it('daftar order tampil dengan status, dan ringkasan semua acara dari laporan', async () => {
    setup();
    expect(await screen.findByText('Pembeli 1')).toBeTruthy();
    expect(screen.getByText('Dibayar', { selector: '.badge' })).toBeTruthy();
    expect(screen.getByText('Menunggu', { selector: '.badge' })).toBeTruthy();
    expect(await screen.findByText(/12 order · Dibayar 8 · Menunggu 3/)).toBeTruthy();
  });

  it('filter acara dan status memengaruhi query order; pindah halaman mengirim page=2', async () => {
    const { calls } = setup();
    await screen.findByText('Pembeli 1');
    fireEvent.click(screen.getByText('Berikutnya'));
    await waitFor(() => expect(call(calls, 'GET /admin/orders?').some((c) => c.key.includes('page=2'))).toBe(true));

    fireEvent.change(screen.getByLabelText('Filter status order'), { target: { value: 'PAID' } });
    await waitFor(() => expect(call(calls, 'GET /admin/orders?').some((c) => c.key.includes('status=PAID') && c.key.includes('page=1'))).toBe(true));

    fireEvent.change(screen.getByLabelText('Filter acara'), { target: { value: 'ev1' } });
    await waitFor(() => expect(calls.some((c) => c.key.startsWith('GET /admin/orders?') && c.key.includes('eventId=ev1'))).toBe(true));
    expect(calls.some((c) => c.key === 'GET /admin/reports/sales?eventId=ev1')).toBe(true);
  });

  it('ubah kategori: PATCH berisi nama, harga, kuota', async () => {
    const { calls } = setup();
    fireEvent.click(within(await rowOf('Reguler')).getByText('Ubah'));
    fireEvent.change(screen.getByLabelText(/Harga/), { target: { value: '120000' } });
    fireEvent.change(screen.getByLabelText(/Kuota/), { target: { value: '150' } });
    fireEvent.click(screen.getByText('Simpan'));
    await waitFor(() => expect(call(calls, 'PATCH /admin/ticket-categories/c1')).toHaveLength(1));
    expect(call(calls, 'PATCH /admin/ticket-categories/c1')[0].body).toEqual({ name: 'Reguler', price: 120000, quota: 150 });
  });

  it('kuota di bawah terjual + tertahan ditolak di browser tanpa memanggil API', async () => {
    const { calls } = setup();
    fireEvent.click(within(await rowOf('Reguler')).getByText('Ubah'));
    const quota = screen.getByLabelText(/Kuota/) as HTMLInputElement;
    expect(quota.min).toBe('50'); // 40 terjual + 10 tertahan
    fireEvent.change(quota, { target: { value: '30' } });
    fireEvent.submit(quota.closest('form')!);
    expect(await screen.findByText(/Kuota minimal 50/)).toBeTruthy();
    expect(call(calls, 'PATCH /admin/ticket-categories/c1')).toHaveLength(0);
  });

  it('hapus kategori yang sudah dipakai order: pesan server tampil', async () => {
    setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(within(await rowOf('VIP')).getByText('Hapus'));
    expect(await screen.findByText(/sudah dipakai di order/)).toBeTruthy();
  });

  it('tambah kategori: wajib pilih acara, lalu POST ke acara tersebut', async () => {
    const { calls } = setup();
    fireEvent.click(await screen.findByText(/Tambah kategori/));
    fireEvent.change(screen.getByLabelText(/Nama kategori/), { target: { value: 'Early Bird' } });
    fireEvent.change(screen.getByLabelText(/Harga/), { target: { value: '75000' } });
    fireEvent.change(screen.getByLabelText(/Kuota/), { target: { value: '200' } });
    fireEvent.submit(screen.getByLabelText(/Nama kategori/).closest('form')!);
    expect(await screen.findByText(/Pilih acara terlebih dahulu/)).toBeTruthy();
    expect(call(calls, 'POST ')).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Acara'), { target: { value: 'ev2' } });
    fireEvent.click(screen.getByText('Simpan'));
    await waitFor(() => expect(call(calls, 'POST /admin/events/ev2/ticket-categories')).toHaveLength(1));
    expect(call(calls, 'POST /admin/events/ev2/ticket-categories')[0].body).toEqual({ name: 'Early Bird', price: 75000, quota: 200 });
  });

  it('data order gagal dimuat tidak menyembunyikan data penjualan (sumber terpisah)', async () => {
    setup({ 'GET /admin/orders': () => ({ status: 500, body: { message: 'order error' } }) });
    expect(await screen.findByText(/Gagal memuat order/)).toBeTruthy();
    expect(await screen.findByText('50% dari kuota 120')).toBeTruthy();
  });

  it('belum ada kategori: empty state, tanpa NaN', async () => {
    setup({ 'GET /admin/reports/sales': () => ({ body: [] }) });
    expect(await screen.findByText(/Belum ada kategori tiket/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
    expect(screen.getByText('0% dari kuota 0')).toBeTruthy();
  });
});
