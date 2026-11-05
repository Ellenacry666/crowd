# Kontrak API (React dan Flutter)

Base URL: `http://<host>:3000/api/v1`. Autentikasi: header `Authorization: Bearer <accessToken>`.

## Format error (semua endpoint)
```json
{ "statusCode": 409, "error": "CONFLICT", "message": "Stok tiket \"VIP\" tidak mencukupi", "code": "INSUFFICIENT_STOCK" }
```
`message` dapat berupa array string untuk error validasi (400). Gunakan `code` untuk logika klien, bukan `message`.

## Login
`POST /auth/login` `{ email, password }` menghasilkan
`{ accessToken, tokenType: "Bearer", expiresIn, user: { id, name, email, role } }`.

## Paginasi
Daftar dengan paginasi: `?page=1&limit=20` (limit maks 100). Respons `{ items: [...], meta: { page, limit, total, totalPages } }`.

## Order dan pembayaran simulasi
- `POST /orders` `{ items: [{ ticketCategoryId, quantity }] }`. Maks 5 tiket per order, satu acara per order. Klien **tidak** mengirim harga (field harga ditolak 400).
- Respons order: `{ id, orderNumber, status, totalAmount, expiresAt, event, items[], lastPayment }`.
- `POST /payments/:orderId/simulate` `{ outcome: "SUCCESS" | "FAILED" }`.
  Respons `{ order, payment: { reference, method: "SIMULATION", status }, ticketsIssued, notice }`.
  Error: 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_PENDING`, 410 `ORDER_EXPIRED`; 404 polos jika simulasi dinonaktifkan.
- UI wajib menampilkan label: "SIMULASI pembayaran untuk demonstrasi akademik, bukan transaksi uang sungguhan".

## Batas tiket per akun per acara
Setiap akun hanya boleh memiliki atau memesan **maksimum 5 tiket untuk setiap acara** (bukan hanya 5 per order). Yang dihitung: order **PAID** dan order **PENDING yang belum kedaluwarsa**. Order FAILED, EXPIRED, atau CANCELLED mengembalikan jatah. Nilai dapat diubah lewat `MAX_TICKETS_PER_USER_PER_EVENT` (bawaan 5).

- `POST /orders` ditolak **409** `TICKET_LIMIT_REACHED` bila jumlah baru melebihi sisa jatah. Pemeriksaan dilakukan di server dalam transaksi yang dikunci per (akun, acara), sehingga permintaan paralel dari tab atau klien lain tidak dapat menembus batas.
- `GET /orders/quota/:idOrSlug` (CUSTOMER) menghasilkan `{ "limit": 5, "used": 3, "remaining": 2 }`. UI memakainya untuk membatasi pilihan jumlah dan menonaktifkan tombol beli saat `remaining` = 0.

## Foto pemegang tiket (syarat pembelian)
Pembayaran `SUCCESS` ditolak sampai setiap tiket punya satu foto. Alur: buat order, unggah foto per slot, bayar.

| Endpoint | Role | Fungsi |
|---|---|---|
| `GET /orders/:orderId/photos` | CUSTOMER (pemilik), ADMIN | `{ required, uploaded, slots: [{ slot, uploaded, photoId, updatedAt }] }` |
| `PUT /orders/:orderId/photos/:slot` | CUSTOMER (pemilik) | `multipart/form-data`: field `photo` (berkas JPG/PNG/WebP, maks 5 MB) dan `consent` (`"true"`). Slot 1..jumlah tiket. Mengganti foto bila slot sudah terisi. Respons `{ slot, uploaded: true }` |
| `GET /orders/:orderId/photos/:slot/image` | CUSTOMER (pemilik), ADMIN | Byte gambar |
| `GET /tickets/:ticketId/photo` | CUSTOMER (pemilik), ADMIN, GATE_STAFF (ditugaskan ke acara) | Byte gambar foto pemegang. Selain itu 404 |

Gambar tidak punya URL publik. Klien mengambilnya dengan header `Authorization` (React: `responseType: 'blob'` lalu `URL.createObjectURL`; Flutter: `http.get` dengan header, tampilkan lewat `Image.memory`).

Kode error: 400 `CONSENT_REQUIRED`, `PHOTO_REQUIRED`, `INVALID_IMAGE`, `INVALID_SLOT`; 409 `DUPLICATE_PHOTO`, `ORDER_NOT_PENDING`, `PHOTOS_REQUIRED` (pada pembayaran); 410 `ORDER_EXPIRED`; 413 berkas lebih dari 5 MB; 404 `PHOTO_NOT_FOUND` / `ORDER_NOT_FOUND`.

## Tiket (`GET /tickets/my`)
```json
[{ "id": "uuid", "ticketCode": "Z2BFE62E7CY6DLHD2AKWZ5KTAU",
   "qrPayload": "CP1.Z2BFE62E7CY6DLHD2AKWZ5KTAU.d2a2ac6a2698a3151c000fc9",
   "status": "ACTIVE", "paymentStatus": "PAID", "orderNumber": "CP-261025-1A2B3C4D",
   "categoryName": "VIP", "event": { "id", "title", "location", "startAt", "endAt", "posterUrl" },
   "issuedAt": "...", "checkedInAt": null, "hasHolderPhoto": true }]
```
Web menampilkan `qrPayload` sebagai QR Code. `status` adalah status penggunaan: `ACTIVE | USED | CANCELLED | EXPIRED`.

## Check-in (`POST /checkin`, role GATE_STAFF)
Request: `{ "eventId": "uuid", "qrPayload": "CP1...." }`.

Semua hasil bisnis dikembalikan dengan HTTP **200** dan `success` true atau false. APK harus membaca `result`, bukan hanya status HTTP.

Sukses:
```json
{ "success": true, "result": "SUCCESS", "message": "Check-in berhasil",
  "ticket": { "id", "ticketCode", "categoryName", "eventTitle", "checkedInAt": "ISO", "hasHolderPhoto": true } }
```
Ditolak:
```json
{ "success": false, "result": "ALREADY_USED", "message": "Tiket sudah digunakan", "firstCheckedInAt": "ISO" }
```

| result | Arti | Tampilan APK |
|---|---|---|
| SUCCESS | Check-in berhasil | Hijau, VALID |
| ALREADY_USED | Tiket sudah dipakai (`firstCheckedInAt` terisi) | Merah |
| INVALID_TOKEN | QR bukan tiket CrowdPulse, signature salah, atau tiket tidak ada | Merah |
| NOT_PAID | Order belum PAID | Merah |
| CANCELLED_OR_EXPIRED | Tiket dibatalkan atau kedaluwarsa | Merah |
| WRONG_EVENT | Tiket untuk acara lain | Merah |

Kondisi lain memakai kode HTTP:
- **403** `code: "NOT_AUTHORIZED"`: petugas tidak ditugaskan ke acara itu (percobaan tetap tercatat), atau role bukan GATE_STAFF (`code: "FORBIDDEN"`).
- **404** `EVENT_NOT_FOUND`: acara tidak ada.
- **401**: token tidak valid atau akun dinonaktifkan.
- **429**: terlalu banyak request.
- **Tidak ada respons / timeout**: APK menampilkan "Validasi belum dapat dilakukan" dan **tidak pernah** meloloskan pengunjung.

## Alur gerbang dua langkah (APK)
1. **Pratinjau** `POST /checkin/preview` `{ eventId, qrPayload }`. **Tidak mengubah apa pun** (status tiket tetap ACTIVE, tidak ada log check-in). Role GATE_STAFF yang ditugaskan ke acara.
2. APK menampilkan foto pemegang (`GET /tickets/{ticket.id}/photo`, header Authorization) dan nama pembeli. Petugas mencocokkan wajah orang di depannya.
3. Cocok: petugas menekan "Izinkan masuk" dan APK memanggil `POST /checkin` (atomik, tercatat). Tidak cocok: petugas menolak dan tidak memanggil apa pun; tiket tetap aman untuk pemilik sah.

Respons pratinjau siap dipakai:
```json
{ "success": true, "result": "READY", "message": "Tiket valid. Cocokkan foto pemegang, lalu konfirmasi masuk.",
  "ticket": { "id": "uuid", "ticketCode": "...", "categoryName": "VIP", "eventTitle": "...",
              "buyerName": "Budi Santoso", "hasHolderPhoto": true, "status": "ACTIVE", "checkedInAt": null } }
```
Penolakan memakai `result` yang sama dengan `/checkin` (`INVALID_TOKEN`, `WRONG_EVENT`, `NOT_PAID`, `CANCELLED_OR_EXPIRED`, `ALREADY_USED`). Hanya `ALREADY_USED` yang menyertakan `ticket` dan `firstCheckedInAt`; penolakan lain sengaja tidak membocorkan data tiket. Data yang ditampilkan ke petugas sengaja minimal: nama pembeli dan foto. Email, nomor order, dan token QR tidak dikirim. Hanya upaya tanpa izin (403) yang dicatat pada pratinjau.

## Petugas
- `GET /staff/events` menghasilkan `[{ id, title, location, startAt, endAt, status, stats: { issued, checkedIn } }]`.
- `GET /staff/checkins?eventId=&result=&page=&limit=` menghasilkan riwayat scan milik petugas yang login saja: `{ items: [{ id, result, reason, scannedAt, eventId, eventTitle, ticket: { ticketCode, categoryName } | null }], meta }`.
