// Dibaca saat dipanggil (bukan di-cache) agar perubahan env pada test dapat diterapkan.
export const MAX_TICKETS_PER_ORDER = 5;

/** Batas tiket per AKUN per ACARA (semua order PAID + PENDING yang belum kedaluwarsa). Bawaan 5. */
export function maxTicketsPerUserPerEvent(): number {
  const n = Number(process.env.MAX_TICKETS_PER_USER_PER_EVENT ?? 5);
  return Number.isInteger(n) && n >= 1 ? n : 5;
}

export function isPaymentSimulationEnabled(): boolean {
  return process.env.PAYMENT_SIMULATION_ENABLED === 'true';
}

export function orderExpiryMinutes(): number {
  const n = Number(process.env.ORDER_EXPIRY_MINUTES ?? 15);
  return Number.isFinite(n) && n > 0 ? n : 15;
}
