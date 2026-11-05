import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './components/toast';
import StaffAccountsPage from './pages/StaffAccountsPage';
import { mockApi } from './test-utils';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const person = (id: string, name: string, isActive = true) =>
  ({ id, name, email: `${name.toLowerCase()}@x.id`, role: 'GATE_STAFF', isActive, eventIds: ['e1'], createdAt: '2026-11-01T08:00:00Z' });

function setup(postResult: { status?: number; body?: unknown } = {}) {
  const api = mockApi({
    'GET /admin/staff': () => ({ body: [person('A', 'Alya'), person('B', 'Budi', false)] }),
    'POST /admin/staff': ({ body }) => ({ status: postResult.status ?? 201, body: postResult.body ?? { id: 'N', ...body, isActive: true, eventIds: [] } }),
    'PATCH /admin/staff/A': ({ body }) => ({ body: { ...person('A', 'Alya'), ...body } }),
    'PATCH /admin/staff/B': ({ body }) => ({ body: { ...person('B', 'Budi'), ...body } }),
  });
  render(<MemoryRouter><ToastProvider><StaffAccountsPage /></ToastProvider></MemoryRouter>);
  return api;
}
const call = (calls: Array<{ key: string; body: any }>, key: string) => calls.find((c) => c.key === key);
const fill = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });

describe('Akun petugas', () => {
  it('menampilkan daftar dengan status aktif/nonaktif', async () => {
    setup();
    expect(await screen.findByText('Alya')).toBeTruthy();
    expect(screen.getByText('Aktif')).toBeTruthy();
    expect(screen.getByText('Nonaktif')).toBeTruthy();
  });

  it('membuat petugas: POST berisi nama, email, password; email dirapikan', async () => {
    const { calls } = setup();
    fireEvent.click(await screen.findByText(/Tambah petugas/));
    fill(/Nama lengkap/, '  Citra Dewi ');
    fill(/^Email/, ' citra@x.id ');
    fill('Password', 'Petugas123');
    fireEvent.click(screen.getByText('Buat akun'));
    await waitFor(() => expect(call(calls, 'POST /admin/staff')).toBeTruthy());
    expect(call(calls, 'POST /admin/staff')!.body).toEqual({ name: 'Citra Dewi', email: 'citra@x.id', password: 'Petugas123' });
    expect(await screen.findByText(/Akun petugas Citra Dewi dibuat/)).toBeTruthy();
  });

  it('password lemah ditolak di browser tanpa memanggil API', async () => {
    const { calls } = setup();
    fireEvent.click(await screen.findByText(/Tambah petugas/));
    fill(/Nama lengkap/, 'Citra');
    fill(/^Email/, 'citra@x.id');
    fill('Password', 'abcdefgh'); // tanpa angka
    fireEvent.click(screen.getByText('Buat akun'));
    expect(await screen.findByText(/minimal satu huruf dan satu angka/)).toBeTruthy();
    expect(call(calls, 'POST /admin/staff')).toBeUndefined();
  });

  it('tombol Acak mengisi password yang valid dan menampilkannya', async () => {
    setup();
    fireEvent.click(await screen.findByText(/Tambah petugas/));
    fireEvent.click(screen.getByText('Acak'));
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.value).toMatch(/^(?=.*[A-Z])(?=.*\d).{12}$/);
  });

  it('email sudah terdaftar (409): pesan server tampil dan modal tetap terbuka', async () => {
    setup({ status: 409, body: { message: 'Email sudah terdaftar' } });
    fireEvent.click(await screen.findByText(/Tambah petugas/));
    fill(/Nama lengkap/, 'Citra');
    fill(/^Email/, 'alya@x.id');
    fill('Password', 'Petugas123');
    fireEvent.click(screen.getByText('Buat akun'));
    expect((await screen.findAllByText(/Email sudah terdaftar/)).length).toBeGreaterThan(0);
    expect(screen.getByText('Buat akun')).toBeTruthy();
  });

  it('ubah tanpa mengisi password: PATCH tidak membawa field password dan email tidak bisa diubah', async () => {
    const { calls } = setup();
    fireEvent.click((await screen.findAllByText('Ubah'))[0]);
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).disabled).toBe(true);
    fill(/Nama lengkap/, 'Alya Putri');
    fireEvent.click(screen.getByText('Simpan perubahan'));
    await waitFor(() => expect(call(calls, 'PATCH /admin/staff/A')).toBeTruthy());
    expect(call(calls, 'PATCH /admin/staff/A')!.body).toEqual({ name: 'Alya Putri' });
  });

  it('menonaktifkan butuh konfirmasi; dibatalkan = tidak ada request', async () => {
    const { calls } = setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(await screen.findByText('Nonaktifkan'));
    expect(confirm).toHaveBeenCalled();
    expect(call(calls, 'PATCH /admin/staff/A')).toBeUndefined();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByText('Nonaktifkan'));
    await waitFor(() => expect(call(calls, 'PATCH /admin/staff/A')).toBeTruthy());
    expect(call(calls, 'PATCH /admin/staff/A')!.body).toEqual({ isActive: false });
  });

  it('mengaktifkan kembali tanpa konfirmasi', async () => {
    const { calls } = setup();
    fireEvent.click(await screen.findByText('Aktifkan'));
    await waitFor(() => expect(call(calls, 'PATCH /admin/staff/B')).toBeTruthy());
    expect(call(calls, 'PATCH /admin/staff/B')!.body).toEqual({ isActive: true });
  });
});
