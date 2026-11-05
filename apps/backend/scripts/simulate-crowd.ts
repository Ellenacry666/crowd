/**
 * Simulator layanan analisis kamera: mengirim data crowd + gate ke API tiap beberapa detik.
 * Dipakai untuk demo dashboard tanpa model computer vision sungguhan.
 *
 *   npm run sim:crowd
 *   API_URL=http://192.168.1.10:3000/api/v1 GATE_KEY=cpk_... CROWD_KEY=cpk_... npm run sim:crowd
 *
 * Default memakai API key demo dari prisma/seed.ts (event "Konser Live Demo").
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const GATE_KEY = process.env.GATE_KEY ?? 'cpk_demo_gate_key_0123456789abcdef0123456789';
const CROWD_KEY = process.env.CROWD_KEY ?? 'cpk_demo_crowd_key_0123456789abcdef012345678';
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 3000);
let crowd = Number(process.env.START_COUNT ?? 900);

async function send(key: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/crowd/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-camera-key': key },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function tick() {
  const entering = Math.max(0, Math.round(Math.random() * 6));
  const leaving = Math.max(0, Math.round(Math.random() * 2));
  crowd = Math.max(0, crowd + entering - leaving + Math.round((Math.random() - 0.5) * 12));
  try {
    await Promise.all([
      send(GATE_KEY, { inCount: entering, outCount: leaving }),
      send(CROWD_KEY, { peopleCount: crowd }),
    ]);
    console.log(`${new Date().toISOString()}  gate +${entering}/-${leaving}  crowd=${crowd}`);
  } catch (e) {
    console.error('Gagal kirim:', (e as Error).message);
  }
}

console.log(`Simulator -> ${API_URL} tiap ${INTERVAL_MS / 1000}s (Ctrl+C untuk berhenti)`);
void tick();
setInterval(tick, INTERVAL_MS);
