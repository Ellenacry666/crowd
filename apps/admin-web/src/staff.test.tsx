import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './components/toast';
import StaffPage from './pages/StaffPage';
import { mockApi } from './test-utils';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const iso = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const ev = (id: string, title: string, status: string) => ({ id, title, status, location: 'X', startAt: iso(60), endAt: iso(180), category: 'Music', ticketCategories: [] });
const person = (id: string, name: string, eventIds: string[], isActive = true) =>
  ({ id, name, email: `${name.toLowerCase()}@x.id`, role: 'GATE_STAFF', isActive, eventIds });

function setup(putStatus = 200) {
  const staff = [person('A', 'Alya', ['e1']), person('B', 'Budi', ['e1']), person('C', 'Citra', []), person('D', 'Dewi', [], false)];
  const api = mockApi({
    'GET /admin/events?limit=100': () => ({ body: { items: [ev('e1', 'Konser Aktif', 'PUBLISHED'), ev('e2', 'Private Showcase', 'DRAFT')], meta: {} } }),
    'GET /admin/staff': () => ({ body: staff }),
    'PUT /admin/events/e1/staff': ({ body }) => (putStatus === 200 ? { body: { eventId: 'e1', staffIds: body.staffIds } } : { status: putStatus, body: { message: 'Beberapa id bukan akun petugas (GATE_STAFF)' } }),
    'PUT /admin/events/e2/staff': ({ body }) => ({ body: { eventId: 'e2', staffIds: body.staffIds } }),
  });
  render(<MemoryRouter><ToastProvider><StaffPage /></ToastProvider></MemoryRouter>);
  return api;
}
const putCall = (calls: Array<{ key: string; body: any }>, path: string) => calls.find((c) => c.key === `PUT ${path}`);

describe('Penugasan petugas', () => {
  it('menampilkan acara beserta petugas yang sudah ditugaskan', async () => {
    setup();
    expect(await screen.findByText('Konser Aktif')).toBeTruthy();
    expect(screen.getByText('Alya')).toBeTruthy();
    expect(screen.getByText('Budi')).toBeTruthy();
    expect(screen.getByText('Atur petugas (2)')).toBeTruthy();
  });

  it('menambah satu petugas: PUT mengirim SELURUH daftar (yang lama + yang baru), bukan hanya yang baru', async () => {
    const { calls } = setup();
    fireEvent.click(await screen.findByText('Atur petugas (2)'));
    fireEvent.click(await screen.findByLabelText(/Citra/));
    fireEvent.click(screen.getByText('Simpan penugasan'));
    await waitFor(() => expect(putCall(calls, '/admin/events/e1/staff')).toBeTruthy());
    expect([...putCall(calls, '/admin/events/e1/staff')!.body.staffIds].sort()).toEqual(['A', 'B', 'C']);
    expect(await screen.findByText(/Penugasan “Konser Aktif” disimpan/)).toBeTruthy();
  });

  it('melepas satu petugas: yang masih dipilih tetap dikirim', async () => {
    const { calls } = setup();
    fireEvent.click(await screen.findByText('Atur petugas (2)'));
    fireEvent.click(await screen.findByLabelText(/Budi/));
    fireEvent.click(screen.getByText('Simpan penugasan'));
    await waitFor(() => expect(putCall(calls, '/admin/events/e1/staff')).toBeTruthy());
    expect(putCall(calls, '/admin/events/e1/staff')!.body.staffIds).toEqual(['A']);
  });

  it('tanpa perubahan tombol simpan nonaktif; akun nonaktif tidak bisa baru ditugaskan', async () => {
    setup();
    fireEvent.click(await screen.findByText('Atur petugas (2)'));
    const save = (await screen.findByText('Simpan penugasan')) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect((screen.getByLabelText(/Dewi/) as HTMLInputElement).disabled).toBe(true);
  });

  it('acara Draft: peringatan bahwa belum tampil di aplikasi petugas', async () => {
    setup();
    fireEvent.click((await screen.findAllByText(/Atur petugas \(0\)/))[0]);
    expect(await screen.findByText(/baru muncul di aplikasi petugas setelah berstatus/)).toBeTruthy();
  });

  it('gagal menyimpan: pesan error tampil (toast + di modal) dan modal tetap terbuka', async () => {
    setup(400);
    fireEvent.click(await screen.findByText('Atur petugas (2)'));
    fireEvent.click(await screen.findByLabelText(/Citra/));
    fireEvent.click(screen.getByText('Simpan penugasan'));
    expect((await screen.findAllByText(/bukan akun petugas/)).length).toBeGreaterThan(0);
    expect(screen.getByText('Simpan penugasan')).toBeTruthy();
  });
});
