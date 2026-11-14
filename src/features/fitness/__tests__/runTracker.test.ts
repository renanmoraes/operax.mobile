import { addPoint, averagePace, currentPace, decimateTrack, emptyRun, formatPace, haversine, resumeAt, type GpsPoint } from '../runTracker';

const t0 = 1_700_000_000_000;
// ~0,0001° de latitude ≈ 11,1 m
const pt = (i: number, over: Partial<GpsPoint> = {}): GpsPoint => ({ at: t0 + i * 4000, lat: -19.9 + i * 0.0001, lng: -43.9, altitude: 850, accuracy: 5, speed: null, ...over });

describe('gravação de corrida com GPS', () => {
  it('distância de haversine bate com a geografia', () => {
    expect(haversine({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 })).toBeCloseTo(111.2, 0);
  });

  it('soma a distância, monta a trilha e calcula o ritmo', () => {
    let s = emptyRun();
    for (let i = 0; i <= 30; i++) s = addPoint(s, pt(i), t0);
    expect(s.distanceM).toBeGreaterThan(330);
    expect(s.distanceM).toBeLessThan(336);
    expect(s.track.t[0]).toBe(0);
    expect(s.track.t.length).toBe(31);
    // 11,1 m a cada 4 s ≈ 6'00"/km
    expect(formatPace(currentPace(s))).toBe(`6'00"`);
    expect(formatPace(averagePace(s, 120))).toBe(`6'00"`);
  });

  it('descarta ponto impreciso e salto impossível do GPS', () => {
    let s = addPoint(emptyRun(), pt(0), t0);
    s = addPoint(s, pt(1, { accuracy: 60 }), t0);
    s = addPoint(s, pt(2, { lat: -19.85 }), t0); // 5 km em 8 s
    expect(s.distanceM).toBe(0);
    expect(s.rejected).toBe(2);
  });

  it('subida só conta acima de 3 m (ruído da altitude não vira ganho)', () => {
    let s = emptyRun();
    const alts = [850, 851, 849, 852, 855, 858, 857, 861];
    alts.forEach((a, i) => (s = addPoint(s, pt(i, { altitude: a }), t0)));
    expect(s.elevationGainM).toBe(11); // 850→855 (+5) e 855→858? não; 855→861 (+6)
  });

  it('depois da pausa, o primeiro ponto só reposiciona', () => {
    let s = addPoint(addPoint(emptyRun(), pt(0), t0), pt(1), t0);
    const before = s.distanceM;
    s = resumeAt(s);
    s = addPoint(s, pt(40), t0); // longe, depois da pausa
    expect(s.distanceM).toBe(before);
  });

  it('trilha para o servidor fica entre 3 e 1500 pontos', () => {
    const big = { t: Array.from({ length: 5000 }, (_, i) => i), dist: Array.from({ length: 5000 }, (_, i) => i * 3) };
    const d = decimateTrack(big)!;
    expect(d.t.length).toBeLessThanOrEqual(1500);
    expect(d.t[0]).toBe(0);
    expect(decimateTrack({ t: [0, 1], dist: [0, 2] })).toBeUndefined();
  });
});
