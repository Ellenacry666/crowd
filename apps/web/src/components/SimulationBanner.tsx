export default function SimulationBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="note"
      className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="font-bold">SIMULASI PEMBAYARAN</p>
      {!compact && (
        <p className="mt-1">
          Fitur ini hanya untuk demonstrasi akademik. Tidak ada transaksi uang sungguhan dan tidak
          ada data kartu atau rekening yang diminta.
        </p>
      )}
    </div>
  );
}
