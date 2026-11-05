export type Role = 'ADMIN' | 'CUSTOMER' | 'GATE_STAFF';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'FINISHED';
export type CameraType = 'GATE' | 'CROWD';
export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'NEVER' | 'DISABLED';
export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type LineupPhase = 'UPCOMING' | 'LIVE' | 'DONE';
export type MonitoringStatus = 'NOT_STARTED' | 'ACTIVE' | 'INACTIVE';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface TicketCategory {
  id: string;
  name: string;
  price: number;
  quota: number;
  available: number;
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

export interface Paged<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface Camera {
  id: string;
  eventId: string;
  type: CameraType;
  name: string;
  streamUrl: string | null;
  capacity: number | null;
  isActive: boolean;
  lastSeenAt: string | null;
  status: CameraStatus;
  /** Hanya ada saat kamera baru dibuat atau key dibuat ulang. */
  apiKey?: string;
}

export interface Lineup {
  id: string;
  eventId: string;
  artistName: string;
  isGuestStar: boolean;
  startAt: string;
  endAt: string;
  notes: string | null;
  phase: LineupPhase;
}

export interface LineupAnalytics extends Lineup {
  avgPeople: number | null;
  peakPeople: number | null;
  baselineAvg: number | null;
  upliftPct: number | null;
  samples: number;
}

export interface GateSection {
  configured: boolean;
  status: MonitoringStatus;
  lastSnapshotAt: string | null;
  totalIn: number;
  totalOut: number;
  insideNow: number;
  inLast5Min: number;
  series: { t: string; in: number; out: number }[];
}

export interface CrowdSection {
  configured: boolean;
  status: MonitoringStatus;
  current: number | null;
  lastSnapshotAt: string | null;
  density: number | null;
  avg: number | null;
  peak: number | null;
  capacity: number | null;
  occupancyPct: number | null;
  level: CrowdLevel | null;
  series: { t: string; avg: number; max: number }[];
}

export interface Dashboard {
  generatedAt: string;
  windowMinutes: number;
  bucketSeconds: number;
  event: { id: string; title: string; location: string; startAt: string; endAt: string; status: EventStatus };
  cameras: Camera[];
  gate: GateSection;
  crowd: CrowdSection;
  lineups: LineupAnalytics[];
  currentLineup: LineupAnalytics | null;
  nextLineup: LineupAnalytics | null;
}

/** Statistik tiket check-in: sumbernya tabel tiket, terpisah dari Dashboard (kamera). */
export interface CheckInStats {
  eventId: string;
  issued: number;
  checkedIn: number;
  notCheckedIn: number;
  percentage: number;
  invalidTickets: number;
  lastCheckInAt: string | null;
  generatedAt: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  eventIds: string[];
  createdAt?: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

/** GET /admin/reports/sales: satu baris per kategori tiket. Pendapatan berasal dari pembayaran simulasi. */
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

export interface OrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  event: { id: string; title: string } | null;
  items: { ticketCategoryId: string; categoryName: string; quantity: number; unitPrice: number; subtotal: number }[];
  user: { id: string; name: string; email: string };
}

export interface ReportSummary {
  orders: { total: number; byStatus: Partial<Record<OrderStatus, number>> };
  simulatedRevenue: number;
}
