// Ngày nghỉ lễ, Tết theo Bộ luật Lao động 2019 (Điều 112), for a year: what the
// "Ngày nghỉ lễ" dialog proposes. Lunar dates (Tết Nguyên đán, Giỗ Tổ Hùng Vương) come from
// the Vietnamese lunar calendar (UTC+7), computed with Hồ Ngọc Đức's published algorithm.
//
// The law fixes the number of days; each year the Government announces exactly which days
// around Tết and Quốc khánh are taken. The defaults here (last day of the lunar year + mùng
// 1–4; the day next to 2/9 that makes the longer break) match most years, and the dialog says
// to check them against that year's announcement.

const TZ = 7;
const { floor, sin, PI } = Math;

function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  return dd + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4) - floor(y / 100) + floor(y / 400) - 32045;
}

function jdToDay(jd: number): string {
  const a = jd + 32044;
  const b = floor((4 * a + 3) / 146097);
  const c = a - floor((b * 146097) / 4);
  const d = floor((4 * c + 3) / 1461);
  const e = c - floor((1461 * d) / 4);
  const m = floor((5 * e + 2) / 153);
  const day = e - floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * floor(m / 10);
  const year = b * 100 + d - 4800 + floor(m / 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function newMoonDay(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  const c1 =
    (0.1734 - 0.000393 * T) * sin(M * dr) + 0.0021 * sin(2 * dr * M)
    - 0.4068 * sin(Mpr * dr) + 0.0161 * sin(dr * 2 * Mpr)
    - 0.0004 * sin(dr * 3 * Mpr)
    + 0.0104 * sin(dr * 2 * F) - 0.0051 * sin(dr * (M + Mpr))
    - 0.0074 * sin(dr * (M - Mpr)) + 0.0004 * sin(dr * (2 * F + M))
    - 0.0004 * sin(dr * (2 * F - M)) - 0.0006 * sin(dr * (2 * F + Mpr))
    + 0.001 * sin(dr * (2 * F - Mpr)) + 0.0005 * sin(dr * (2 * Mpr + M));
  const deltaT = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return floor(jd1 + c1 - deltaT + 0.5 + TZ / 24);
}

/** Sun longitude sector (0–11) at the start of a day. */
function sunSector(jdn: number): number {
  const T = (jdn - 0.5 - TZ / 24 - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * sin(dr * 2 * M) + 0.00029 * sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= PI * 2 * floor(L / (PI * 2));
  return floor((L / PI) * 6);
}

/** First day of the 11th lunar month (the one holding the winter solstice) of a year. */
function lunarMonth11(yy: number): number {
  const k = floor((jdFromDate(31, 12, yy) - 2415021) / 29.530588853);
  const nm = newMoonDay(k);
  return sunSector(nm) >= 9 ? newMoonDay(k - 1) : nm;
}

function leapMonthOffset(a11: number): number {
  const k = floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let i = 1;
  let arc = sunSector(newMoonDay(k + i));
  let last: number;
  do {
    last = arc;
    i++;
    arc = sunSector(newMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

/** "YYYY-MM-DD" of a day of the lunar calendar (non-leap month). */
export function lunarToSolar(lunarDay: number, lunarMonth: number, lunarYear: number): string {
  const [a11, b11] = lunarMonth < 11 ? [lunarMonth11(lunarYear - 1), lunarMonth11(lunarYear)] : [lunarMonth11(lunarYear), lunarMonth11(lunarYear + 1)];
  const k = floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365 && off >= leapMonthOffset(a11)) off += 1;
  return jdToDay(newMoonDay(k + off) + lunarDay - 1);
}

const shift = (day: string, by: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday

export interface StatutoryHoliday {
  day: string;
  name: string;
}

/**
 * The paid public holidays of a year (11 days), plus a "nghỉ bù" on the next working day
 * for each one that falls on a Sunday (Điều 111 khoản 3); Saturday is a working morning here.
 */
export function statutoryHolidays(year: number): StatutoryHoliday[] {
  const tet = lunarToSolar(1, 1, year);
  const quocKhanh = `${year}-09-02`;
  // The day next to 2/9: the one that joins the weekend (a Tuesday 2/9 takes Monday 1/9).
  const nextToQuocKhanh = weekday(quocKhanh) === 2 ? `${year}-09-01` : `${year}-09-03`;
  const list: StatutoryHoliday[] = [
    { day: `${year}-01-01`, name: "Tết Dương lịch" },
    { day: shift(tet, -1), name: "Tết Nguyên đán (cuối năm Âm lịch)" },
    ...[1, 2, 3, 4].map((n) => ({ day: shift(tet, n - 1), name: `Tết Nguyên đán (mùng ${n})` })),
    { day: lunarToSolar(10, 3, year), name: "Giỗ Tổ Hùng Vương (10/3 Âm lịch)" },
    { day: `${year}-04-30`, name: "Ngày Giải phóng miền Nam" },
    { day: `${year}-05-01`, name: "Ngày Quốc tế Lao động" },
    { day: quocKhanh, name: "Quốc khánh" },
    { day: nextToQuocKhanh, name: "Quốc khánh (ngày liền kề)" },
  ].sort((a, b) => a.day.localeCompare(b.day));

  const taken = new Set(list.map((h) => h.day));
  const extra: StatutoryHoliday[] = [];
  for (const h of list) {
    if (weekday(h.day) !== 0) continue;
    let day = shift(h.day, 1);
    while (taken.has(day) || weekday(day) === 0) day = shift(day, 1);
    taken.add(day);
    extra.push({ day, name: `Nghỉ bù ${h.name}` });
  }
  return [...list, ...extra].filter((h) => h.day.startsWith(`${year}-`)).sort((a, b) => a.day.localeCompare(b.day));
}
