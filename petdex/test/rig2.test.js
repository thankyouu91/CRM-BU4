// Rig 2.0 (public/ta-tua/game/js/rig2): ảnh mẫu (golden) khớp từng điểm ảnh, và kiểm tra khói cho cả thư viện.
// - Ảnh mẫu: Boba, Mèo Bạc, Chim Cánh Cụt trưởng thành (đứng/đi 4 hướng, cảm xúc, đeo vương miện + kính + khăn) và Boba sơ sinh,
//   cùng bố cục với ảnh của bản mẫu pets-pilot (petdex/test/golden/rig2/README.txt ghi những chỗ cố ý khác).
//   Vẽ lại ảnh mẫu SAU KHI đã xem kỹ: RIG2_UPDATE_GOLDEN=1 node --test petdex/test/rig2.test.js
// - Khói: mọi loài × mọi giai đoạn tuổi × mọi hướng vẽ được, đúng bảng 48 màu, không điểm bán trong suốt, không chạm mép ô,
//   chân ở hàng 44; mọi món đồ đeo vẽ được ở mọi hướng.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { decodePng, encodePng } from '../../scripts/art/png.mjs';

const GAME = '../../public/ta-tua/game/js/';
const { LIFE_STAGES, MASCOTS, SPECIES, WEARABLES } = await import(`${GAME}shared/pets.js`);
const rig = await import(`${GAME}rig2/index.js`);

const GOLDEN = new URL('./golden/rig2/', import.meta.url);
const UPDATE = process.env.RIG2_UPDATE_GOLDEN === '1';
const VIEWS = ['S', 'E', 'N', 'W'];
const WEAR = { head: 'crown', face: 'glasses', neck: 'scarf' };
const ROWS = ['idle', 'walk'].flatMap((a) => VIEWS.map((v) => [a, v]));
const EMOTES = ['wave', 'jump', 'sad', 'think', 'busy', 'spin'].map((a) => [a, 'S']);

/** Một tấm sheet như bản mẫu: mỗi hàng một hoạt ảnh-hướng, mỗi cột một khung 48×48. */
function sheet(id, stage, rows, wear = {}) {
  const runs = rows.map(([a, v]) => rig.renderAnim(id, stage, a, v, wear).frames);
  const cols = Math.max(...runs.map((f) => f.length));
  const w = cols * 48;
  const out = { w, h: rows.length * 48, data: new Uint8ClampedArray(w * rows.length * 48 * 4) };
  runs.forEach((frames, r) => frames.forEach(({ img }, i) => {
    for (let y = 0; y < 48; y++) out.data.set(img.data.subarray(y * 48 * 4, (y + 1) * 48 * 4), ((r * 48 + y) * w + i * 48) * 4);
  }));
  return out;
}

const CASES = [
  ['pet-boba-adult', 'boba', 'adult', ROWS, {}],
  ['pet-boba-adult-wear', 'boba', 'adult', ROWS, WEAR],
  ['pet-boba-baby', 'boba', 'baby', ROWS, {}],
  ['pet-boba-baby-wear', 'boba', 'baby', ROWS, WEAR],
  ['pet-meo_bac-adult', 'meo_bac', 'adult', ROWS, {}],
  ['pet-meo_bac-adult-wear', 'meo_bac', 'adult', ROWS, WEAR],
  ['pet-canh_cut-adult', 'canh_cut', 'adult', ROWS, {}],
  ['pet-canh_cut-adult-wear', 'canh_cut', 'adult', ROWS, WEAR],
  ['pet-boba-adult-emotes', 'boba', 'adult', EMOTES, {}],
  ['pet-meo_bac-adult-emotes', 'meo_bac', 'adult', EMOTES, {}],
  ['pet-canh_cut-adult-emotes', 'canh_cut', 'adult', EMOTES, {}],
];

for (const [name, id, stage, rows, wear] of CASES) {
  test(`ảnh mẫu Rig 2.0: ${name} khớp từng điểm ảnh`, () => {
    const got = sheet(id, stage, rows, wear);
    const file = new URL(`${name}.png`, GOLDEN);
    if (UPDATE) {
      mkdirSync(GOLDEN, { recursive: true });
      writeFileSync(file, encodePng(got));
    }
    assert.ok(existsSync(file), `thiếu ảnh mẫu ${name}.png (chạy với RIG2_UPDATE_GOLDEN=1 sau khi đã xem kỹ)`);
    const want = decodePng(readFileSync(file));
    assert.equal(got.w, want.w);
    assert.equal(got.h, want.h);
    const bad = [];
    for (let k = 0; k < got.w * got.h; k++) {
      for (let c = 0; c < 4; c++) {
        if (got.data[k * 4 + c] !== want.data[k * 4 + c]) {
          bad.push(`(${k % got.w},${Math.floor(k / got.w)})`);
          break;
        }
      }
    }
    assert.equal(bad.length, 0, `${bad.length} điểm ảnh khác ảnh mẫu, ví dụ ${bad.slice(0, 8).join(' ')}`);
  });
}

test('điểm neo đồ đeo khớp bản mẫu (Boba trưởng thành, đứng chơi khung 0)', () => {
  const near = (a, b) => Math.abs(a - b) < 0.051;
  const want = { S: { head: [24.0, 13.9], face: [24.0, 24.6], neck: [24.0, 32.1], back: [24.0, 29.5] } };
  const { anchors } = rig.renderFrame('boba', 'adult', 'S', {}, {});
  for (const [k, [x, y]] of Object.entries(want.S)) assert.ok(near(anchors[k][0], x) && near(anchors[k][1], y), `${k}: ${anchors[k]}`);
  // Hướng W là hướng E lật: điểm neo đối xứng qua x = 24.
  const e = rig.renderFrame('boba', 'adult', 'E', {}, {}).anchors;
  const w = rig.renderFrame('boba', 'adult', 'W', {}, {}).anchors;
  for (const k of Object.keys(e)) assert.ok(near(w[k][0], 48 - e[k][0]) && near(w[k][1], e[k][1]), k);
});

const ALL = [...MASCOTS, ...SPECIES];

test('khói: 51 loài × 6 giai đoạn × 4 hướng đều vẽ được, đúng bảng màu, trong ô, chân ở hàng 44', () => {
  assert.equal(ALL.length, 51);
  const problems = [];
  for (const sp of ALL) {
    for (const st of LIFE_STAGES) {
      for (const v of VIEWS) {
        const tag = `${sp.id}/${st.key}/${v}`;
        let img;
        try {
          ({ img } = rig.renderFrame(sp, st.key, v, {}, {}));
        } catch (err) {
          problems.push(`${tag}: lỗi ${err.message}`);
          continue;
        }
        const a = rig.auditFrame(img);
        if (a.offPalette) problems.push(`${tag}: ${a.offPalette} điểm ngoài bảng màu`);
        if (a.semi) problems.push(`${tag}: ${a.semi} điểm bán trong suốt`);
        if (a.edge) problems.push(`${tag}: ${a.edge} điểm chạm mép ô`);
        // Chân: không tính dấu hiệu (hào quang, gậy...), hàng 44 là viền dưới chân và là hàng thấp nhất;
        // ngoại lệ của bản mẫu: nhìn sau, đuôi dẹt (rái cá) nằm về phía người xem, xuống tới hàng 46.
        const bare = rig.renderFrame(sp, st.key, v, {}, {}, { marks: false }).img;
        const rowHas = (y) => [...Array(48).keys()].some((x) => bare.data[(y * 48 + x) * 4 + 3]);
        const low = Math.max(...[...Array(48).keys()].filter(rowHas));
        const allowed = v === 'N' && sp.tail === 'flat' ? 46 : 44;
        if (!rowHas(44) || low > allowed) problems.push(`${tag}: chân không ở hàng 44 (hàng thấp nhất ${low})`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('khói: mọi dáng hoạt ảnh của mọi loài (trưởng thành, cấp 50) vẽ được và đúng bảng màu', () => {
  const problems = [];
  for (const sp of ALL) {
    for (const anim of Object.keys(rig.ANIMS)) {
      for (const v of anim === 'idle' || anim === 'walk' ? VIEWS : ['S']) {
        try {
          for (const { img } of rig.renderAnim(sp, 'adult', anim, v, {}, { level: 50 }).frames) {
            const a = rig.auditFrame(img);
            if (a.offPalette || a.semi || a.edge) problems.push(`${sp.id}/${anim}/${v}: ${JSON.stringify(a)}`);
          }
        } catch (err) {
          problems.push(`${sp.id}/${anim}/${v}: lỗi ${err.message}`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('khói: mọi món đồ đeo vẽ được ở mọi hướng, trên 3 dáng khung và bé sơ sinh, đúng bảng màu', () => {
  const problems = [];
  for (const [id, w] of Object.entries(WEARABLES)) {
    for (const [sp, st] of [['boba', 'adult'], ['meo_bac', 'adult'], ['canh_cut', 'adult'], ['boba', 'baby'], ['thanh_long', 'elder']]) {
      for (const v of VIEWS) {
        try {
          const { img } = rig.renderFrame(sp, st, v, { step: 1 }, { [w.slot]: id });
          const a = rig.auditFrame(img);
          if (a.offPalette || a.semi) problems.push(`${id} trên ${sp}/${st}/${v}: ${JSON.stringify(a)}`);
        } catch (err) {
          problems.push(`${id} trên ${sp}/${st}/${v}: lỗi ${err.message}`);
        }
      }
    }
    assert.ok(rig.wearIcon(id), `${id}: chưa có hình biểu tượng`);
  }
  assert.deepEqual(problems, []);
});

test('bảng dải màu: đủ 51 loài, mọi dải trong core.js, cánh cụt là xanh đen', async () => {
  const { SPECIES_RAMPS } = await import(`${GAME}rig2/ramps.js`);
  for (const sp of ALL) {
    const row = SPECIES_RAMPS[sp.id];
    assert.ok(row, `${sp.id} chưa có dòng trong ramps.js`);
    for (const r of Object.values(row)) assert.ok(rig.RAMPS[r], `${sp.id}: không có dải ${r}`);
  }
  for (const [name, ramp] of Object.entries(rig.RAMPS)) {
    assert.equal(ramp.length, 5, name);
    for (const hex of ramp) assert.ok(rig.inPalette(hex), `${name}: ${hex} ngoài bảng màu`);
  }
  assert.equal(SPECIES_RAMPS.canh_cut.main, 'navy');
});
