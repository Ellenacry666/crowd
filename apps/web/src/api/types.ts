export type Role = 'ADMIN' | 'CUSTOMER' | 'GATE_STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'FINISHED';
export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
export type TicketStatus = 'ACTIVE' | 'USED' | 'CANCELLED' | 'EXPIRED';

export interface TicketCategory {
  id: string;
  name: string;
  price: number;
  quota: number;
  available: number;
  /** Hanya tersedia pada endpoint admin. */
  soldCount?: number;
  reservedCount?: number;
}

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  posterUrl: string | null;
  status: EventStatus;
  minPrice: number | null;
  ticketCategories: TicketCategory[];
}

export interface OrderLine {
  ticketCategoryId: string;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  expiresAt: string;
  createdAt: string;
  event: { id: string; title: string; slug: string; startAt: string; location: string } | null;
  items: OrderLine[];
  lastPayment: { reference: string; status: string; method: string; createdAt: string } | null;
}

export interface AdminOrder extends Order {
  user: { id: string; name: string; email: string };
}

export interface PaymentResult {
  order: { id: string; orderNumber: string; status: OrderStatus; totalAmount: number };
  payment: { reference: string; method: string; status: string };
  ticketsIssued: number;
  notice: string;
}

export interface TicketEvent {
  id: string;
  title: string;
  slug: string;
  location: string;
  startAt: string;
  endAt: string;
  posterUrl: string | null;
}

export interface Ticket {
  id: string;
  ticketCode: string;
  /** Tidak dikirim ke endpoint admin. */
  qrPayload?: string;
  status: TicketStatus;
  paymentStatus: OrderStatus;
  orderNumber: string;
  categoryName: string;
  event: TicketEvent;
  issuedAt: string;
  checkedInAt: string | null;
  /** Tiket memiliki foto pemegang (foto diambil lewat endpoint terpisah yang terautentikasi). */
  hasHolderPhoto: boolean;
}

export interface EventQuota {
  /** Batas tiket per akun per acara. */
  limit: number;
  /** Tiket yang sudah dimiliki atau dipesan (PAID + PENDING yang belum kedaluwarsa). */
  used: number;
  remaining: number;
}

export interface PhotoSlot {
  slot: number;
  uploaded: boolean;
  photoId: string | null;
  updatedAt: string | null;
}

export interface PhotoStatus {
  required: number;
  uploaded: number;
  slots: PhotoSlot[];
}

export interface AdminTicket extends Ticket {
  owner: { id: string; name: string; email: string };
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  eventIds: string[];
}

export interface Summary {
  events: { total: number; byStatus: Record<string, number> };
  orders: { total: number; byStatus: Record<string, number> };
  tickets: { issued: number; byStatus: Record<string, number> };
  simulatedRevenue: number;
}

export interface SalesRow {
  ticketCategoryId: string;
  eventId: string;
  eventTitle: string;
  name: string;
  price: number;
  quota: number;
  soldCount: number;
  reservedCount: number;
  available: number;
  ticketsPaid: number;
  simulatedRevenue: number;
}

export interface CheckinReport {
  ticketsIssued: number;
  ticketsCheckedIn: number;
  byResult: Record<string, number>;
  recent: {
    id: string;
    result: string;
    reason: string | null;
    scannedAt: string;
    staffName: string;
    eventTitle: string;
    ticketCode: string | null;
  }[];
}

export interface EventPayload {
  title?: string;
  slug?: string;
  category?: string;
  description?: string;
  location?: string;
  startAt?: string;
  endAt?: string;
  posterUrl?: string;
  status?: EventStatus;
}
