# Daftar Endpoint API CrowdPulse Ticketing

Prefix: `/api/v1`. Swagger: `/api/docs`.
Format error seragam: `{ statusCode, error, message, code }`.
Respons check-in memuat `result` (enum `CheckInResult`) dan `message`.

Status implementasi: **Tahap 2** = sudah ada di kode; **Tahap 3** = belum.

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
| GET | /events?search=&category=&dateFrom=&dateTo=&page= | Publik | Daftar acara PUBLISHED | 3 |
| GET | /events/:idOrSlug | Publik | Detail acara + kategori + sisa stok | 3 |
| GET | /admin/events | ADMIN | Semua acara (termasuk DRAFT) | 3 |
| POST | /admin/events | ADMIN | Buat acara | 3 |
| PATCH | /admin/events/:id | ADMIN | Ubah acara | 3 |
| DELETE | /admin/events/:id | ADMIN | Hapus/arsipkan (ditolak jika sudah ada order PAID) | 3 |
| POST | /admin/events/:id/ticket-categories | ADMIN | Tambah kategori | 3 |
| PATCH | /admin/ticket-categories/:id | ADMIN | Ubah harga/kuota (kuota tidak boleh kurang dari terjual+cadangan) | 3 |
| DELETE | /admin/ticket-categories/:id | ADMIN | Hapus (jika belum ada penjualan) | 3 |

## Orders dan pembayaran
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| POST | /orders | CUSTOMER | Buat order `{items:[{ticketCategoryId, quantity}]}` | 3 |
| GET | /orders/my | CUSTOMER | Riwayat order sendiri | 3 |
| GET | /orders/:id | CUSTOMER (pemilik) / ADMIN | Detail order | 3 |
| POST | /payments/:orderId/simulate | CUSTOMER (pemilik) | `{outcome: SUCCESS\|FAILED}`; aktif hanya jika flag demo menyala | 3 |
| GET | /admin/orders | ADMIN | Daftar order + filter | 3 |

## Tiket
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| GET | /tickets/my | CUSTOMER | Tiket milik sendiri | 3 |
| GET | /tickets/:id | CUSTOMER (pemilik) | Detail tiket + `qrPayload` | 3 |
| GET | /admin/tickets?eventId=&status= | ADMIN | Daftar tiket terbit | 3 |

## Check-in (petugas)
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| GET | /staff/events | GATE_STAFF | Acara yang ditugaskan | 3 |
| POST | /checkin | GATE_STAFF | `{eventId, qrPayload}`, validasi atomik | 3 |
| GET | /staff/checkins?eventId=&page= | GATE_STAFF | Riwayat scan milik sendiri | 3 |

## Admin: petugas dan laporan
| Method | Path | Role | Fungsi | Tahap |
|---|---|---|---|---|
| POST | /admin/staff | ADMIN | Buat akun petugas | 3 |
| GET | /admin/staff | ADMIN | Daftar petugas | 3 |
| PATCH | /admin/staff/:id | ADMIN | Ubah/nonaktifkan | 3 |
| PUT | /admin/events/:id/staff | ADMIN | Atur penugasan petugas ke acara | 3 |
| GET | /admin/reports/summary | ADMIN | Jumlah acara, order, pendapatan simulasi | 3 |
| GET | /admin/reports/sales?eventId= | ADMIN | Penjualan per kategori | 3 |
| GET | /admin/reports/checkins?eventId= | ADMIN | Ringkasan check-in dan log | 3 |

Catatan: `/admin/ping`, `/staff/ping`, `/customer/ping` adalah endpoint sementara Tahap 2 untuk membuktikan RBAC dan akan dihapus di Tahap 3.
