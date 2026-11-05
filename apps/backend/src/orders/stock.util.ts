import { Prisma } from '@prisma/client';

export interface StockLine {
  ticketCategoryId: string;
  quantity: number;
}

const sorted = (lines: StockLine[]) =>
  [...lines].sort((a, b) => a.ticketCategoryId.localeCompare(b.ticketCategoryId));

/** Melepas stok yang dicadangkan (order gagal atau kedaluwarsa). Harus dipanggil di dalam transaksi. */
export async function releaseReserved(tx: Prisma.TransactionClient, lines: StockLine[]) {
  for (const line of sorted(lines)) {
    const r = await tx.ticketCategory.updateMany({
      where: { id: line.ticketCategoryId, reservedCount: { gte: line.quantity } },
      data: { reservedCount: { decrement: line.quantity } },
    });
    if (r.count !== 1) {
      throw new Error(`Stock invariant violated (release) for category ${line.ticketCategoryId}`);
    }
  }
}

/** Memindahkan cadangan menjadi terjual (pembayaran berhasil). Harus dipanggil di dalam transaksi. */
export async function commitReservedToSold(tx: Prisma.TransactionClient, lines: StockLine[]) {
  for (const line of sorted(lines)) {
    const r = await tx.ticketCategory.updateMany({
      where: { id: line.ticketCategoryId, reservedCount: { gte: line.quantity } },
      data: {
        reservedCount: { decrement: line.quantity },
        soldCount: { increment: line.quantity },
      },
    });
    if (r.count !== 1) {
      throw new Error(`Stock invariant violated (commit) for category ${line.ticketCategoryId}`);
    }
  }
}
