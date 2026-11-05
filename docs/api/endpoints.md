# Daftar Endpoint API CrowdPulse Ticketing

Prefix: `/api/v1`. Swagger: `/api/docs`.
Format error seragam: `{ statusCode, error, message, code }`.
Respons check-in memuat `result` (enum `CheckInResult`) dan `message`.

Status implementasi: seluruh endpoint di bawah sudah diimplementasikan di kode (Tahap 2 dan Tahap 3). Hasil uji otomatis dicatat di `docs/testing`.

## Auth
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| POST | /auth/register | Publik | Registrasi CUSTOMER | 2 |
| POST | /auth/login | Publik | Login semua role, mengembalikan JWT | 2 |
| GET | /auth/me | Login | Profil sendiri | 2 |
| GET | /health | Publik | Health check | 2 |

## Events dan kategori
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| GET | /events?search=&category=&dateFrom=&dateTo=&page= | Publik | Daftar acara PUBLISHED | 3 (selesai) |
| GET | /events/:idOrSlug | Publik | Detail acara + kategori + sisa stok | 3 (selesai) |
| GET | /admin/events | ADMIN | Semua acara (termasuk DRAFT) | 3 (selesai) |
| POST | /admin/events | ADMIN | Buat acara | 3 (selesai) |
| PATCH | /admin/events/:id | ADMIN | Ubah acara | 3 (selesai) |
| DELETE | /admin/events/:id | ADMIN | Hapus/arsipkan (ditolak jika sudah ada order PAID) | 3 (selesai) |
| POST | /admin/events/:id/ticket-categories | ADMIN | Tambah kategori | 3 (selesai) |
| PATCH | /admin/ticket-categories/:id | ADMIN | Ubah harga/kuota (kuota tidak boleh kurang dari terjual+cadangan) | 3 (selesai) |
| DELETE | /admin/ticket-categories/:id | ADMIN | Hapus (jika belum ada penjualan) | 3 (selesai) |

## Orders dan pembayaran
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| POST | /orders | CUSTOMER | Buat order `{items:[{ticketCategoryId, quantity}]}` | 3 (selesai) |
| GET | /orders/my | CUSTOMER | Riwayat order sendiri | 3 (selesai) |
| GET | /orders/:id | CUSTOMER (pemilik) / ADMIN | Detail order | 3 (selesai) |
| POST | /payments/:orderId/simulate | CUSTOMER (pemilik) | `{outcome: SUCCESS\|FAILED}`; aktif hanya jika flag demo menyala | 3 (selesai) |
| GET | /admin/orders | ADMIN | Daftar order + filter | 3 (selesai) |

## Jatah pembelian
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| GET | /orders/quota/:idOrSlug | CUSTOMER | Sisa jatah akun untuk acara `{limit, used, remaining}` | 4 (selesai) |

## Tiket
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| GET | /tickets/my | CUSTOMER | Tiket milik sendiri | 3 (selesai) |
| GET | /tickets/:id | CUSTOMER (pemilik) | Detail tiket + `qrPayload` | 3 (selesai) |
| GET | /admin/tickets?eventId=&status= | ADMIN | Daftar tiket terbit | 3 (selesai) |

## Foto pemegang tiket
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| GET | /orders/:orderId/photos | CUSTOMER (pemilik) / ADMIN | Status foto per slot | 4 (selesai) |
| PUT | /orders/:orderId/photos/:slot | CUSTOMER (pemilik) | Unggah/ganti foto (multipart) | 4 (selesai) |
| GET | /orders/:orderId/photos/:slot/image | CUSTOMER (pemilik) / ADMIN | Gambar foto order | 4 (selesai) |
| GET | /tickets/:ticketId/photo | CUSTOMER (pemilik) / ADMIN / GATE_STAFF (ditugaskan) | Gambar foto pemegang tiket | 4 (selesai) |

## Check-in (petugas)
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| GET | /staff/events | GATE_STAFF | Acara yang ditugaskan | 3 (selesai) |
| POST | /checkin/preview | GATE_STAFF | Pratinjau tiket + data pemegang, tanpa mengubah status | 4 (selesai) |
| POST | /checkin | GATE_STAFF | `{eventId, qrPayload}`, validasi atomik | 3 (selesai) |
| GET | /staff/checkins?eventId=&page= | GATE_STAFF | Riwayat scan milik sendiri | 3 (selesai) |

## Admin: petugas dan laporan
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| POST | /admin/staff | ADMIN | Buat akun petugas | 3 (selesai) |
| GET | /admin/staff | ADMIN | Daftar petugas | 3 (selesai) |
| PATCH | /admin/staff/:id | ADMIN | Ubah/nonaktifkan | 3 (selesai) |
| PUT | /admin/events/:id/staff | ADMIN | Atur penugasan petugas ke acara | 3 (selesai) |
| GET | /admin/reports/summary | ADMIN | Jumlah acara, order, pendapatan simulasi | 3 (selesai) |
| GET | /admin/reports/sales?eventId= | ADMIN | Penjualan per kategori | 3 (selesai) |
| GET | /admin/reports/checkins?eventId= | ADMIN | Ringkasan check-in dan log | 3 (selesai) |

Catatan: endpoint sementara `/admin/ping`, `/staff/ping`, `/customer/ping` sudah dihapus. Matriks RBAC kini diuji pada endpoint asli (`/admin/events`, `/staff/events`, `/tickets/my`).

Kontrak respons check-in dan format lain: lihat `docs/api/contract.md`.
