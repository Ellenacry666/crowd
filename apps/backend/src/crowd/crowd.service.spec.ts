import { crowdLevel } from './crowd.service';
import { toCameraResponse } from './cameras.service';
import { generateCameraKey, hashCameraKey } from './camera-key.util';
import { lineupPhase } from '../lineups/lineups.service';

describe('crowdLevel', () => {
  it.each([
    [0, 'LOW'],
    [49.9, 'LOW'],
    [50, 'MODERATE'],
    [74.9, 'MODERATE'],
    [75, 'HIGH'],
    [89.9, 'HIGH'],
    [90, 'CRITICAL'],
    [130, 'CRITICAL'],
  ])('%s%% -> %s', (pct, level) => {
    expect(crowdLevel(pct)).toBe(level);
  });
});

describe('camera key', () => {
  it('menghasilkan key unik dan hash deterministik', () => {
    const a = generateCameraKey();
    expect(a).toMatch(/^cpk_[0-9a-f]{48}$/);
    expect(a).not.toBe(generateCameraKey());
    expect(hashCameraKey(a)).toBe(hashCameraKey(a));
    expect(hashCameraKey(a)).not.toContain(a);
  });
});

describe('toCameraResponse', () => {
  const base: any = { id: '1', eventId: 'e', type: 'CROWD', name: 'c', streamUrl: null, capacity: 10, apiKeyHash: 'secret' };
  const now = Date.now();
  it('status berdasarkan lastSeenAt', () => {
    expect(toCameraResponse({ ...base, isActive: true, lastSeenAt: null }, now).status).toBe('NEVER');
    expect(toCameraResponse({ ...base, isActive: true, lastSeenAt: new Date(now - 10_000) }, now).status).toBe('ONLINE');
    expect(toCameraResponse({ ...base, isActive: true, lastSeenAt: new Date(now - 60_000) }, now).status).toBe('OFFLINE');
    expect(toCameraResponse({ ...base, isActive: false, lastSeenAt: new Date(now) }, now).status).toBe('DISABLED');
  });
  it('tidak membocorkan hash API key', () => {
    expect(JSON.stringify(toCameraResponse({ ...base, isActive: true, lastSeenAt: null }))).not.toContain('secret');
  });
});

describe('lineupPhase', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const t = (m: number) => new Date(now.getTime() + m * 60_000);
  it('UPCOMING / LIVE / DONE', () => {
    expect(lineupPhase({ startAt: t(10), endAt: t(20) }, now)).toBe('UPCOMING');
    expect(lineupPhase({ startAt: t(-10), endAt: t(20) }, now)).toBe('LIVE');
    expect(lineupPhase({ startAt: t(-20), endAt: t(0) }, now)).toBe('DONE');
  });
});
