// Rig 2.0 (public/ta-tua/game/js/rig2): ảnh mẫu (golden) khớp từng điểm ảnh, và kiểm tra khói cho cả thư viện.
// - Ảnh mẫu: Boba, Mèo Bạc, Chim Cánh Cụt trưởng thành (đứng/đi 4 hướng, cảm xúc, đeo vương miện + kính + khăn) và Boba sơ sinh,
//   cùng bố cục với ảnh của bản mẫu pets-pilot (petdex/test/golden/rig2/README.txt ghi những chỗ cố ý khác).
//   Vẽ lại ảnh mẫu SAU KHI đã xem kỹ: RIG2_UPDATE_GOLDEN=1 node --test petdex/test/rig2.test.js
// - Khói: mọi loài × mọi giai đoạn tuổi × mọi hướng vẽ được, đúng bảng 48 màu, không điểm bán trong suốt, không chạm mép ô,
//   chân ở hàng 44; mọi món đồ đeo vẽ được ở mọi hướng, trong ô (6 giai đoạn tuổi, đi bộ, nhảy, liếc mắt), và hiện ra ở
//   S và E/W; lớp đồ đeo và luật đặt của gói vẽ phase 2 (WEAR-SPEC D1-D6, báo cáo từng khe); wearIcon cho đúng hình dán S
//   của món và đưa cho hàm vẽ đủ ctx như khi vẽ lên pet; dữ liệu đồ đeo qua được scripts/art/build-wear.mjs --check.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
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

// Mọi món ở trong ô (ARTIST-GUIDE mục 3, 9; WEAR-SPEC) trên 3 dáng khung (biped Boba, quad Mèo Bạc, bird Cánh Cụt) × 6 giai
// đoạn tuổi × 4 hướng, ở khung đi bộ có nhún (step 1, lift −1), khăn lay (flutter 1) và tick 2 (bùa nhún xuống thấp nhất);
// thêm đỉnh cú nhảy (lift −6: món đội đầu bị đẩy xuống cho khỏi chạm mép) và mắt liếc (think: look ±1) ở bé sơ sinh và
// trưởng thành, nhìn S và E; và bé lão làng cấp 50 to nhất.
const WEAR_SPECIES = ['boba', 'meo_bac', 'canh_cut'];
const STAGE_KEYS = LIFE_STAGES.map((s) => s.key);
const WALK1 = { step: 1, bob: 0, tail: -1, flutter: 1, lift: -1 };
const EXTRA_POSES = [
  ['jump', { lift: -6, sq: 1, armL: 1, armR: 1, mouth: 'open', tail: 1 }],
  ['look-1', { look: -1, hx: -1 }],
  ['look+1', { look: 1, hx: 1 }],
];

test('khói: mọi món × 3 dáng khung × 6 giai đoạn × 4 hướng (đi bộ, nhảy, liếc mắt): đúng bảng màu, đục hẳn, không chạm mép ô', () => {
  const problems = [];
  const check = (id, w, sp, st, v, pose, opts, tag) => {
    try {
      const { img } = rig.renderFrame(sp, st, v, pose, { [w.slot]: id }, opts);
      const a = rig.auditFrame(img);
      if (a.offPalette || a.semi || a.edge) problems.push(`${id} trên ${sp}/${st}/${v} ${tag}: ${JSON.stringify(a)}`);
    } catch (err) {
      problems.push(`${id} trên ${sp}/${st}/${v} ${tag}: lỗi ${err.message}`);
    }
  };
  for (const [id, w] of Object.entries(WEARABLES)) {
    for (const sp of WEAR_SPECIES) for (const st of STAGE_KEYS) for (const v of VIEWS) check(id, w, sp, st, v, WALK1, { tick: 2 }, 'walk1');
    for (const sp of WEAR_SPECIES) {
      for (const st of ['baby', 'adult']) for (const v of ['S', 'E']) for (const [tag, p] of EXTRA_POSES) check(id, w, sp, st, v, p, {}, tag);
    }
    for (const v of VIEWS) check(id, w, 'thanh_long', 'elder', v, WALK1, { tick: 2, level: 50 }, 'lv50');
  }
  assert.deepEqual(problems, []);
});

/** So khung có đeo `wear` với khung để trống `bare`: số điểm đổi trên người pet (pet đục) và ngoài người pet. */
function changed(sp, st, v, wear, { pose = {}, bare = {}, tick = 0 } = {}) {
  const a = rig.renderFrame(sp, st, v, pose, bare, { marks: false, tick }).img.data;
  const b = rig.renderFrame(sp, st, v, pose, wear, { marks: false, tick }).img.data;
  let onPet = 0;
  let offPet = 0;
  let x0 = 48;
  let y0 = 48;
  for (let k = 0; k < 48 * 48; k++) {
    const i = k * 4;
    if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3]) continue;
    if (a[i + 3]) onPet++;
    else offPet++;
    x0 = Math.min(x0, k % 48);
    y0 = Math.min(y0, Math.floor(k / 48));
  }
  return { onPet, offPet, x0, y0 };
}
const idsOf = (slot) => Object.keys(WEARABLES).filter((id) => WEARABLES[id].slot === slot);

test('lớp đồ đeo (WEAR-SPEC D6): lưng và bùa dưới pet ở S/E/W, trên pet ở N; vầng hào quang dưới pet; áo choàng đè lưng ở N', () => {
  const bad = [];
  for (const sp of WEAR_SPECIES) {
    for (const st of ['adult', 'baby']) {
      for (const slot of ['back', 'charm']) {
        for (const id of idsOf(slot)) {
          for (const v of ['S', 'E', 'W']) {
            const c = changed(sp, st, v, { [slot]: id });
            if (c.onPet || !c.offPet) bad.push(`${id} ${sp}/${st}/${v}: ${c.onPet} điểm đè lên pet, ${c.offPet} điểm lộ ra`);
          }
        }
      }
    }
    // Áo choàng, ba lô, áo tơi nhìn từ sau: vẽ đè lên lưng.
    for (const id of ['cape', 'wavecape', 'starcape', 'aotoi', 'backpack']) {
      const c = changed(sp, 'adult', 'N', { back: id });
      if (c.onPet < 20) bad.push(`${id} ${sp}/adult/N: chỉ ${c.onPet} điểm đè lên lưng`);
    }
  }
  // Vầng hào quang (layer behind): tai thỏ dựng trước vòng, không điểm nào của pet bị đè, ở cả 3 hướng.
  for (const v of ['S', 'E', 'N', 'W']) {
    const c = changed('tho_la', 'adult', v, { head: 'halo' }, { bare: { head: '_' } });
    if (c.onPet || !c.offPet) bad.push(`halo tho_la/adult/${v}: ${c.onPet} điểm đè lên pet`);
  }
  for (const [slot, id] of [['charm', 'lantern'], ['back', 'cape']]) {
    const e = rig.wearEntry(slot, id);
    assert.equal(rig.wearInFront(slot, e, 'N'), true, `${id}: phải vẽ trên pet ở N`);
    assert.equal(rig.wearInFront(slot, e, 'E'), false, `${id}: phải vẽ dưới pet ở E`);
  }
  assert.equal(rig.wearInFront('head', rig.wearEntry('head', 'halo'), 'N'), false);
  assert.deepEqual(bad, []);
});

test('Boba ôm cốc (WEAR-SPEC D2): ống hút và tay ôm cốc nằm trên mọi món đồ cổ, món cổ nằm trên thân cốc', () => {
  const STRAW = [0xd9, 0x70, 0x8a];
  for (const v of ['S', 'E']) {
    for (const st of ['adult', 'baby']) {
      const bare = rig.renderFrame('boba', st, v, {}, {}, { marks: false }).img.data;
      const straw = [];
      for (let k = 0; k < 48 * 48; k++) if (bare[k * 4 + 3] && STRAW.every((c, i) => bare[k * 4 + i] === c)) straw.push(k);
      assert.ok(straw.length >= 2, `boba/${st}/${v}: không thấy ống hút`);
      for (const id of idsOf('neck')) {
        const got = rig.renderFrame('boba', st, v, {}, { neck: id }, { marks: false }).img.data;
        const lost = straw.filter((k) => !STRAW.every((c, i) => got[k * 4 + i] === c));
        assert.equal(lost.length, 0, `${id} boba/${st}/${v}: che ${lost.length} điểm ống hút`);
      }
    }
  }
  // Thân cốc bị khăn che (khăn vẽ sau thân cốc): hai góc nắp cốc #ecd8bf (màu chỉ cốc có) nằm dưới khăn quàng.
  const LID = [0xec, 0xd8, 0xbf];
  const bare = rig.renderFrame('boba', 'adult', 'S', {}, {}, { marks: false }).img.data;
  const scarf = rig.renderFrame('boba', 'adult', 'S', {}, { neck: 'scarf' }, { marks: false }).img.data;
  let lid = 0;
  let covered = 0;
  for (let k = 0; k < 48 * 48; k++) {
    if (!LID.every((c, i) => bare[k * 4 + i] === c)) continue;
    lid++;
    if (!LID.every((c, i) => scarf[k * 4 + i] === c)) covered++;
  }
  assert.ok(lid > 0 && covered > 0, `nắp cốc ${lid} điểm, khăn che ${covered}`);
});

test('luật đặt đồ đeo: kính liếc theo mắt (S/E, không N), khăn lay ở E, bùa nhún 1 px, tai mèo vẽ lại lên mũ chỉ ở S', async () => {
  // Đồ mặt theo pose.look (báo cáo khe mặt, luật 3).
  for (const [v, want] of [['S', 1], ['E', 1], ['W', -1], ['N', 0]]) {
    const a = changed('boba', 'adult', v, { face: 'goggles' }, { pose: { look: 0 } });
    const b = changed('boba', 'adult', v, { face: 'goggles' }, { pose: { look: 1 } });
    assert.equal(b.x0 - a.x0, want, `goggles ${v}: liếc 1 thì dời ${b.x0 - a.x0}`);
  }
  // Khăn quàng, khăn lá: hàng đuôi khăn dời theo pose.flutter ở E; món khác đứng yên (WEAR-SPEC D3).
  for (const [id, moves] of [['scarf', true], ['leafscarf', true], ['bell', false]]) {
    const f0 = rig.renderFrame('boba', 'adult', 'E', { flutter: 0 }, { neck: id }, { marks: false }).img.data;
    const f1 = rig.renderFrame('boba', 'adult', 'E', { flutter: 1 }, { neck: id }, { marks: false }).img.data;
    const s0 = rig.renderFrame('boba', 'adult', 'S', { flutter: 0 }, { neck: id }, { marks: false }).img.data;
    const s1 = rig.renderFrame('boba', 'adult', 'S', { flutter: 1 }, { neck: id }, { marks: false }).img.data;
    assert.equal(f0.some((c, k) => c !== f1[k]), moves, `${id}: khăn lay ở E`);
    assert.ok(s0.every((c, k) => c === s1[k]), `${id}: hướng S không lay`);
  }
  // Bùa nhún xuống 1 px khi tick % 4 >= 2.
  const t0 = changed('boba', 'adult', 'S', { charm: 'lantern' }, { tick: 0 });
  const t2 = changed('boba', 'adult', 'S', { charm: 'lantern' }, { tick: 2 });
  assert.equal(t2.y0 - t0.y0, 1);
  // earsOver: mũ chóp trên Mèo Bạc (tai mèo hai bên đầu) chỉ ở S; Boba (tai tròn) không đổi.
  const { HEAD } = await import(`${GAME}rig2/wear/head.js`);
  const render = (sp, v) => rig.renderFrame(sp, 'adult', v, {}, { head: 'tophat' }, { marks: false }).img.data;
  const on = { cat: render('meo_bac', 'S'), catE: render('meo_bac', 'E'), boba: render('boba', 'S') };
  HEAD.tophat.earsOver = false;
  try {
    assert.ok(on.cat.some((c, k) => c !== render('meo_bac', 'S')[k]), 'tai mèo không được vẽ lại lên mũ chóp ở S');
    assert.ok(on.catE.every((c, k) => c === render('meo_bac', 'E')[k]), 'earsOver không được dùng ở E');
    assert.ok(on.boba.every((c, k) => c === render('boba', 'S')[k]), 'earsOver chỉ cho tai mèo');
  } finally {
    HEAD.tophat.earsOver = true;
  }
});

test('điểm neo đồ đeo: bùa E ngoài cả đầu (WEAR-SPEC D6), lưng E của thú bốn chân dời lên vai (D4)', () => {
  for (const sp of ALL) {
    for (const st of LIFE_STAGES) {
      const sk = rig.skeleton(sp, st.key, 'E', {});
      const [bcx, , brx] = sk.body;
      const [hcx, , hrx] = sk.head;
      assert.ok(Math.abs(sk.anchors.charm[0] - (Math.min(bcx - brx, hcx - hrx) - 2.5)) < 1e-9, `${sp.id}/${st.key}: neo bùa E`);
      const old = bcx - brx * 0.45;
      const want = sp.body === 'quad' ? Math.max(old, hcx - hrx * 0.8) : old;
      assert.ok(Math.abs(sk.anchors.back[0] - want) < 1e-9, `${sp.id}/${st.key}: neo lưng E`);
    }
  }
  const cat = rig.skeleton(rig.speciesOf('meo_bac'), 'adult', 'E', {});
  assert.ok(cat.anchors.back[0] > cat.body[0] - cat.body[2] * 0.45 + 3, 'Mèo Bạc trưởng thành: neo lưng E phải dời lên phía vai');
});

test('phần "over" của đồ lưng (WEAR-SPEC D1): vẽ sau thân pet, có viền riêng, cằm che', async () => {
  const { BACK } = await import(`${GAME}rig2/wear/back.js`);
  const { dataEntry } = await import(`${GAME}rig2/wear/stamp.js`);
  const saved = BACK.backpack;
  const data = structuredClone(saved.data);
  data.views.S.over = { pivot: [6, 0], rows: ['YY', 'YY', 'YY', 'YY', 'YY', 'YY'] }; // khóa vàng, cột x − 6, x − 5 của neo lưng
  BACK.backpack = dataEntry('back', 'backpack', data);
  try {
    rig.clearWearIcons();
    const plain = changed('boba', 'adult', 'S', { back: 'cape' });
    assert.equal(plain.onPet, 0);
    const c = changed('boba', 'adult', 'S', { back: 'backpack' });
    assert.ok(c.onPet >= 8, `over phải đè lên ngực pet (${c.onPet} điểm)`);
    const [ax, ay] = rig.skeleton('boba', 'adult', 'S', {}).anchors.back;
    const got = rig.renderFrame('boba', 'adult', 'S', {}, { back: 'backpack' }, { marks: false }).img.data;
    const bare = rig.renderFrame('boba', 'adult', 'S', {}, {}, { marks: false }).img.data;
    const px = (img, x, y) => [...img.subarray((y * 48 + x) * 4, (y * 48 + x) * 4 + 4)].join();
    const [x, y] = [Math.floor(ax) - 6, Math.floor(ay)];
    assert.equal(px(got, x, y), px(bare, x, y), 'cằm phải che phần over');
    assert.notEqual(px(got, x, y + 2), px(bare, x, y + 2), 'over dưới cằm phải hiện (trước ngực, trên thân pet)');
    assert.ok(rig.wearIcon('backpack'), 'hình túi đồ của món có over');
  } finally {
    BACK.backpack = saved;
    rig.clearWearIcons();
  }
});

test('wearIcon / wearImage: hình túi đồ của mọi món là đúng hình dán S đã viền, cỡ 1x (đồ mặt: viền bóng ngoài)', async () => {
  const core = await import(`${GAME}rig2/core.js`);
  const { outerOutline } = await import(`${GAME}rig2/wear/stamp.js`);
  for (const slot of ['head', 'face', 'neck', 'back', 'charm']) {
    const DATA = (await import(`${GAME}rig2/wear/data/${slot}.js`)).default;
    for (const [id, item] of Object.entries(DATA)) {
      const raw = core.stamp(item.views.S.rows, item.keys);
      const pic = slot === 'face' ? outerOutline(raw) : core.padOutline(raw);
      const b = core.bbox(pic);
      const want = core.crop(pic, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
      const icon = rig.wearIcon(id);
      assert.ok(icon, `${id}: không có hình túi đồ`);
      assert.deepEqual([icon.img.w, icon.img.h], [want.w, want.h], `${id}: cỡ hình`);
      assert.ok(icon.img.data.every((c, k) => c === want.data[k]), `${id}: hình túi đồ khác hình dán S`);
    }
  }
});

test('hình cũ dự phòng: món thiếu dữ liệu vẫn vẽ được bằng hình rig.js cũ (đúng bảng màu, trong ô)', async () => {
  const mods = {
    head: [await import(`${GAME}rig2/wear/head.js`), 'HEAD', 'tophat'],
    face: [await import(`${GAME}rig2/wear/face.js`), 'FACE', 'shades'],
    neck: [await import(`${GAME}rig2/wear/neck.js`), 'NECK', 'bell'],
    back: [await import(`${GAME}rig2/wear/back.js`), 'BACK', 'cape'],
    charm: [await import(`${GAME}rig2/wear/charm.js`), 'CHARM', 'lantern'],
  };
  for (const [slot, [mod, reg, id]] of Object.entries(mods)) {
    const saved = mod[reg][id];
    delete mod[reg][id];
    try {
      rig.clearWearIcons();
      assert.ok(rig.wearEntry(slot, id)?.legacy, `${slot}/${id}: không về hình cũ`);
      for (const v of VIEWS) {
        const { img } = rig.renderFrame('boba', 'adult', v, { step: 1, lift: -1 }, { [slot]: id }, { tick: 2 });
        const a = rig.auditFrame(img);
        assert.ok(!a.offPalette && !a.semi && !a.edge, `${slot}/${id}/${v}: ${JSON.stringify(a)}`);
      }
      assert.ok(rig.wearIcon(id), `${slot}/${id}: hình cũ không có hình túi đồ`);
    } finally {
      mod[reg][id] = saved;
      rig.clearWearIcons();
    }
  }
});

test('scripts/art/build-wear.mjs --check: dữ liệu đồ đeo hợp lệ (55 món, đúng khe, đúng bảng màu, đủ hướng) và đúng dạng chuẩn', () => {
  const script = fileURLToPath(new URL('../../scripts/art/build-wear.mjs', import.meta.url));
  const args = [script, ...(process.env.RIG2_WEAR_SRC ? [process.env.RIG2_WEAR_SRC] : []), '--check'];
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});

test('khói: món nào đang đeo cũng hiện ra ở hướng S và E (nên cả W) trên 3 dáng khung (bé đi bộ trong công viên dùng E/W)', () => {
  const missing = [];
  for (const sp of ['boba', 'meo_bac', 'canh_cut']) {
    const bare = Object.fromEntries(['S', 'E', 'W'].map((v) => [v, rig.renderFrame(sp, 'adult', v, {}, {}).img.data]));
    for (const [id, w] of Object.entries(WEARABLES)) {
      for (const v of ['S', 'E', 'W']) {
        const got = rig.renderFrame(sp, 'adult', v, {}, { [w.slot]: id }).img.data;
        if (got.every((c, k) => c === bare[v][k])) missing.push(`${id} trên ${sp}/${v}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('wearIcon: mọi mục trong 5 sổ đồ đeo (đã vẽ lại và hình cũ) cho hình, và hàm vẽ nhận đủ ctx như trên pet', async () => {
  const slots = {
    head: await import(`${GAME}rig2/wear/head.js`),
    face: await import(`${GAME}rig2/wear/face.js`),
    neck: await import(`${GAME}rig2/wear/neck.js`),
    back: await import(`${GAME}rig2/wear/back.js`),
    charm: await import(`${GAME}rig2/wear/charm.js`),
  };
  const registry = { head: 'HEAD', face: 'FACE', neck: 'NECK', back: 'BACK', charm: 'CHARM' };
  for (const [slot, mod] of Object.entries(slots)) {
    for (const id of [...Object.keys(mod[registry[slot]]), ...Object.keys(mod.LEGACY)]) {
      assert.equal(WEARABLES[id]?.slot, slot, `${id}: không phải món của khe ${slot} trong shared/pets.js`);
      const icon = rig.wearIcon(id);
      assert.ok(icon && icon.img.w > 0 && icon.img.h > 0, `${slot}/${id}: wearIcon rỗng`);
      const { data } = icon.img;
      for (let k = 0; k < data.length; k += 4) {
        if (!data[k + 3]) continue;
        const hex = `#${[0, 1, 2].map((c) => data[k + c].toString(16).padStart(2, '0')).join('')}`;
        assert.ok(data[k + 3] === 255 && rig.inPalette(hex), `${slot}/${id}: hình biểu tượng có điểm ${hex} ngoài bảng màu`);
      }
    }
  }
  // Một món "của họa sĩ" dùng ctx.ramps, ctx.level, ctx.headMask (ARTIST-GUIDE mục 4): vẽ lên pet được thì hình biểu tượng cũng được.
  const { HEAD } = slots.head;
  const seen = {};
  const spy = (ctx, img) => {
    seen[ctx.chin === null ? 'icon' : 'pet'] = Object.keys(ctx).sort();
    const accent = rig.RAMPS[ctx.ramps.accent][2];
    const [ax, ay] = ctx.sk.anchors.head;
    for (let dx = -2; dx <= 2; dx++) img.data.set([...[1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16)), 255], ((Math.round(ay) - 1) * 48 + Math.round(ax) + dx) * 4);
    if (!ctx.headMask || ctx.level < 1 || !ctx.parts.length) throw new Error('ctx thiếu trường');
  };
  const saved = HEAD.tophat;
  HEAD.tophat = { S: spy, E: spy, N: spy };
  try {
    rig.clearWearIcons();
    rig.renderFrame('boba', 'adult', 'S', {}, { head: 'tophat' });
    const icon = rig.wearIcon('tophat');
    assert.ok(icon, 'wearIcon ném lỗi hoặc rỗng với món dùng ctx.ramps');
    assert.deepEqual(seen.icon, seen.pet, 'wearIcon đưa thiếu trường ctx so với khi vẽ lên pet');
  } finally {
    if (saved) HEAD.tophat = saved;
    else delete HEAD.tophat;
    rig.clearWearIcons();
  }
  // Món vẽ lỗi: wearIcon trả về null (túi đồ hiện ô trống), không làm hỏng màn hình.
  const savedBow = HEAD.bow;
  HEAD.bow = { S: () => { throw new Error('hỏng'); }, E: () => {}, N: () => {} };
  const warn = console.warn;
  console.warn = () => {};
  try {
    rig.clearWearIcons();
    assert.equal(rig.wearIcon('bow'), null);
  } finally {
    console.warn = warn;
    if (savedBow) HEAD.bow = savedBow;
    else delete HEAD.bow;
    rig.clearWearIcons();
  }
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
