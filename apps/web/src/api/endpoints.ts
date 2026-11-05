import { api } from './client';
import type {
  AdminOrder,
  AdminTicket,
  AuthResponse,
  CheckinReport,
  EventItem,
  EventQuota,
  EventPayload,
  Order,
  Paginated,
  PaymentResult,
  PhotoStatus,
  SalesRow,
  Staff,
  Summary,
  Ticket,
  TicketCategory,
  User,
} from './types';

type Params = Record<string, string | number | undefined>;

// Parameter kosong tidak dikirim (backend menolak parameter kosong tertentu).
const clean = (params: Params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),
  register: (name: string, email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { name, email, password }).then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
};

export const eventsApi = {
  list: (params: Params) =>
    api.get<Paginated<EventItem>>('/events', { params: clean(params) }).then((r) => r.data),
  detail: (idOrSlug: string) =>
    api.get<EventItem>(`/events/${encodeURIComponent(idOrSlug)}`).then((r) => r.data),
};

export const ordersApi = {
  create: (items: { ticketCategoryId: string; quantity: number }[]) =>
    api.post<Order>('/orders', { items }).then((r) => r.data),
  mine: () => api.get<Order[]>('/orders/my').then((r) => r.data),
  /** Sisa jatah pembelian akun untuk acara tertentu (id atau slug). */
  quota: (idOrSlug: string) =>
    api.get<EventQuota>(`/orders/quota/${encodeURIComponent(idOrSlug)}`).then((r) => r.data),
  get: (id: string) => api.get<Order>(`/orders/${id}`).then((r) => r.data),
  simulate: (orderId: string, outcome: 'SUCCESS' | 'FAILED') =>
    api.post<PaymentResult>(`/payments/${orderId}/simulate`, { outcome }).then((r) => r.data),
};

export const ticketsApi = {
  mine: () => api.get<Ticket[]>('/tickets/my').then((r) => r.data),
  /** Foto pemegang tiket sebagai Blob (endpoint terautentikasi, tidak dapat dipakai langsung di <img src>). */
  photo: (ticketId: string) =>
    api.get<Blob>(`/tickets/${ticketId}/photo`, { responseType: 'blob' }).then((r) => r.data),
};

export const photosApi = {
  status: (orderId: string) => api.get<PhotoStatus>(`/orders/${orderId}/photos`).then((r) => r.data),
  upload: (orderId: string, slot: number, photo: Blob) => {
    const form = new FormData();
    form.append('consent', 'true'); // pengguna sudah mencentang persetujuan di UI
    form.append('photo', photo, `holder-${slot}.jpg`);
    return api.put(`/orders/${orderId}/photos/${slot}`, form).then((r) => r.data);
  },
  image: (orderId: string, slot: number) =>
    api
      .get<Blob>(`/orders/${orderId}/photos/${slot}/image`, { responseType: 'blob' })
      .then((r) => r.data),
};

export const adminApi = {
  summary: () => api.get<Summary>('/admin/reports/summary').then((r) => r.data),
  sales: (eventId?: string) =>
    api.get<SalesRow[]>('/admin/reports/sales', { params: clean({ eventId }) }).then((r) => r.data),
  checkins: (eventId?: string) =>
    api
      .get<CheckinReport>('/admin/reports/checkins', { params: clean({ eventId }) })
      .then((r) => r.data),

  events: (params: Params) =>
    api.get<Paginated<EventItem>>('/admin/events', { params: clean(params) }).then((r) => r.data),
  event: (id: string) => api.get<EventItem>(`/admin/events/${id}`).then((r) => r.data),
  createEvent: (payload: EventPayload) =>
    api.post<EventItem>('/admin/events', payload).then((r) => r.data),
  updateEvent: (id: string, payload: EventPayload) =>
    api.patch<EventItem>(`/admin/events/${id}`, payload).then((r) => r.data),
  deleteEvent: (id: string) => api.delete(`/admin/events/${id}`).then((r) => r.data),

  createCategory: (eventId: string, body: { name: string; price: number; quota: number }) =>
    api
      .post<TicketCategory>(`/admin/events/${eventId}/ticket-categories`, body)
      .then((r) => r.data),
  updateCategory: (id: string, body: { name?: string; price?: number; quota?: number }) =>
    api.patch<TicketCategory>(`/admin/ticket-categories/${id}`, body).then((r) => r.data),
  deleteCategory: (id: string) => api.delete(`/admin/ticket-categories/${id}`).then((r) => r.data),

  orders: (params: Params) =>
    api.get<Paginated<AdminOrder>>('/admin/orders', { params: clean(params) }).then((r) => r.data),
  tickets: (params: Params) =>
    api.get<Paginated<AdminTicket>>('/admin/tickets', { params: clean(params) }).then((r) => r.data),

  staff: () => api.get<Staff[]>('/admin/staff').then((r) => r.data),
  createStaff: (body: { name: string; email: string; password: string }) =>
    api.post<Staff>('/admin/staff', body).then((r) => r.data),
  updateStaff: (id: string, body: { name?: string; isActive?: boolean; password?: string }) =>
    api.patch<Staff>(`/admin/staff/${id}`, body).then((r) => r.data),
  assignStaff: (eventId: string, staffIds: string[]) =>
    api.put(`/admin/events/${eventId}/staff`, { staffIds }).then((r) => r.data),
};
