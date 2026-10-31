// Rig 2.0 (public/ta-tua/game/js/rig2): ảnh mẫu (golden) khớp từng điểm ảnh, và kiểm tra khói cho cả thư viện.
// - Ảnh mẫu: Boba, Mèo Bạc, Chim Cánh Cụt trưởng thành (đứng/đi 4 hướng, cảm xúc, đeo vương miện + kính + khăn) và Boba sơ sinh,
//   cùng bố cục với ảnh của bản mẫu pets-pilot (petdex/test/golden/rig2/README.txt ghi những chỗ cố ý khác).
//   Vẽ lại ảnh mẫu SAU KHI đã xem kỹ: RIG2_UPDATE_GOLDEN=1 node --test petdex/test/rig2.test.js
// - Khói: mọi loài × mọi giai đoạn tuổi × mọi hướng vẽ được, đúng bảng 48 màu, không điểm bán trong suốt, không chạm mép ô,
//   chân ở hàng 44; mọi món đồ đeo vẽ được ở mọi hướng, trong ô (6 giai đoạn tuổi, đi bộ, nhảy, liếc mắt), và hiện ra
//   (ít nhất 8 điểm) ở S và E trên cả 51 loài × sơ sinh/nhí nhố/trưởng thành; lớp đồ đeo và luật đặt của gói vẽ phase 2
//   (WEAR-SPEC D1-D6, báo cáo từng khe) tính lại độc lập từ dữ liệu; wearIcon cho đúng hình dán của món (hướng `icon`)
//   và đưa cho hàm vẽ đủ ctx như khi vẽ lên pet; dữ liệu đồ đeo qua được scripts/art/build-wear.mjs --check.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from '../../scripts/art/png.mjs';

const GAME = '../../public/ta-tua/game/js/';
const { LIFE_STAGES, MASCOTS, SPECIES, WEARABLES } = await import(`${GAME}shared/pets.js`);
const rig = await import(`${GAME}rig2/index.js`);

const { BACK } = await import(`${GAME}rig2/wear/back.js`);

/** Gọi fn với món lưng `id` tạm bỏ phần "over" (WEAR-SPEC D1: khóa áo, quai ba lô trước ngực), để soát riêng phần chính. */
function withoutOver(id, fn) {
  const saved = BACK[id];
  if (!saved?.over) return fn();
  BACK[id] = { ...saved, over: undefined };
  try {
    return fn();
  } finally {
    BACK[id] = saved;
  }
}

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

// Quét toàn bộ thư viện sau khi gộp mọi nhánh vẽ (dáng tròn, rồng, tai, đuôi, hoa văn, mặt, đặc điểm, dấu hiệu, đồ đeo):
// 51 loài × 6 giai đoạn × S/E/N/W × mọi hoạt ảnh × cấp 1 và 50 (dấu hiệu cấp, hào quang, lão làng bật như trong game).
// W là khung E lật nguyên (index.js), nên W được kiểm qua E (lật không đổi màu, chạm mép trái thành chạm mép phải), và một
// mẫu nhỏ xác nhận W đúng là E lật. 'spin' tự quay đủ 4 hướng nên chỉ chạy một lần.
test('khói (bản gộp): 51 loài × 6 giai đoạn × S/E/N/W × mọi hoạt ảnh, cấp 1 và 50: đúng bảng màu, đục hẳn, không chạm mép', async () => {
  const core = await import(`${GAME}rig2/core.js`);
  const problems = [];
  let frames = 0;
  for (const sp of ALL) {
    for (const st of LIFE_STAGES) {
      for (const level of [1, 50]) {
        for (const anim of Object.keys(rig.ANIMS)) {
          for (const v of anim === 'spin' ? ['S'] : ['S', 'E', 'N']) {
            rig.renderAnim(sp, st.key, anim, v, {}, { level }).frames.forEach(({ img }, i) => {
              frames++;
              const a = rig.auditFrame(img);
              if (a.offPalette || a.semi || a.edge) problems.push(`${sp.id}/${st.key}/L${level}/${anim}[${i}]/${v}: ${JSON.stringify(a)}`);
            });
          }
        }
      }
    }
  }
  assert.ok(frames > 60000, `chỉ quét ${frames} khung`);
  for (const id of ['boba', 'nhim_reu', 'thanh_long', 'ga_trong']) {
    for (const pose of rig.animPoses(rig.speciesOf(id), 'walk', 'E')) {
      const e = rig.renderFrame(id, 'adult', 'E', pose, {}, { level: 50 }).img;
      const w = rig.renderFrame(id, 'adult', 'W', pose, {}, { level: 50 }).img;
      assert.ok(core.mirror(e).data.every((c, k) => c === w.data[k]), `${id}: W phải là E lật`);
    }
  }
  assert.deepEqual(problems, []);
});

// Mọi món ở trong ô (ARTIST-GUIDE mục 3, 9; WEAR-SPEC) trên 3 dáng khung (biped Boba, quad Mèo Bạc, bird Cánh Cụt) × 6 giai
// đoạn tuổi × 4 hướng, ở khung đi bộ có nhún (step 1, lift −1), khăn lay (flutter 1) và tick 2 (bùa nhún xuống thấp nhất);
// thêm đỉnh cú nhảy (lift −6: món đội đầu lên cùng đầu, renderFrame hạ cả cú nhảy cho khỏi chạm mép) và mắt liếc (think:
// look ±1) ở bé sơ sinh và trưởng thành, nhìn S và E; và bé lão làng cấp 50 to nhất.
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

/** So khung có đeo `wear` với khung để trống `bare`: số điểm đổi trên người pet (pet đục) và ngoài người pet, cột trái/phải và hàng trên cùng của vùng đổi. */
function changed(sp, st, v, wear, { pose = {}, bare = {}, tick = 0 } = {}) {
  const a = rig.renderFrame(sp, st, v, pose, bare, { marks: false, tick }).img.data;
  const b = rig.renderFrame(sp, st, v, pose, wear, { marks: false, tick }).img.data;
  let onPet = 0;
  let offPet = 0;
  let x0 = 48;
  let y0 = 48;
  let x1 = -1;
  for (let k = 0; k < 48 * 48; k++) {
    const i = k * 4;
    if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3]) continue;
    if (a[i + 3]) onPet++;
    else offPet++;
    x0 = Math.min(x0, k % 48);
    x1 = Math.max(x1, k % 48);
    y0 = Math.min(y0, Math.floor(k / 48));
  }
  return { onPet, offPet, x0, x1, y0 };
}
const idsOf = (slot) => Object.keys(WEARABLES).filter((id) => WEARABLES[id].slot === slot);

const TAILS = await import(`${GAME}rig2/parts/tails.js`);
/** Gọi fn() trong lúc đuôi của loài `sp` (tailFor: kể cả đuôi riêng của loài, như cánh cụt) tạm thời là đuôi rỗng. */
function withoutTail(sp, fn) {
  const t = TAILS.tailFor(rig.speciesOf(sp));
  // Mọi chỗ trong hai sổ trỏ tới đúng mục này (đuôi tạm dùng chung mục: fan = puff, curl = thin).
  const slots = [TAILS.TAILS, TAILS.FALLBACK].flatMap((r) => Object.keys(r).filter((k) => r[k] === t).map((k) => [r, k]));
  const empty = { S() {}, E() {}, N() {} };
  for (const [r, k] of slots) r[k] = empty;
  try {
    return fn();
  } finally {
    for (const [r, k] of slots) r[k] = t;
  }
}
/** Điểm của phần ĐUÔI thò ra ngoài thân: khung có đuôi khác khung cùng loài bỏ đuôi. */
function tailMask(sp, st, v, pose = {}) {
  const a = rig.renderFrame(sp, st, v, pose, {}, { marks: false }).img.data;
  const b = withoutTail(sp, () => rig.renderFrame(sp, st, v, pose, {}, { marks: false }).img.data);
  const m = new Uint8Array(48 * 48);
  for (let k = 0; k < 48 * 48; k++) if ([0, 1, 2, 3].some((c) => a[k * 4 + c] !== b[k * 4 + c])) m[k] = 1;
  return m;
}
/** Như changed(), tách điểm đè lên pet thành trên đuôi (tail) và trên phần còn lại (body). */
function changedOnTail(sp, st, v, wear) {
  const a = rig.renderFrame(sp, st, v, {}, {}, { marks: false }).img.data;
  const b = rig.renderFrame(sp, st, v, {}, wear, { marks: false }).img.data;
  const tail = tailMask(sp, st, v);
  const out = { tail: 0, body: 0, off: 0 };
  for (let k = 0; k < 48 * 48; k++) {
    const i = k * 4;
    if ([0, 1, 2, 3].every((c) => a[i + c] === b[i + c])) continue;
    if (!a[i + 3]) out.off++;
    else if (tail[k]) out.tail++;
    else out.body++;
  }
  return out;
}
const DRAPES = ['aotoi', 'cape', 'starcape', 'wavecape'];

test('lớp đồ đeo (WEAR-SPEC D6): lưng và bùa dưới pet ở S/E/W, trên pet ở N; vầng hào quang dưới pet; áo choàng đè lưng ở N', () => {
  const bad = [];
  for (const sp of WEAR_SPECIES) {
    const quad = rig.speciesOf(sp).body === 'quad';
    for (const st of ['adult', 'baby']) {
      for (const slot of ['back', 'charm']) {
        for (const id of idsOf(slot)) {
          for (const v of ['S', 'E', 'W']) {
            if (quad && v !== 'S' && DRAPES.includes(id)) continue; // D4: áo choàng phủ lưng thú bốn chân nhìn ngang (test riêng)
            // Đồ lưng nhìn ngang được phủ lên phần đuôi thò ra ngoài thân (backOverTail), không bao giờ lên thân.
            // Nhìn trước: phần chính dưới pet; phần "over" (khóa áo, quai ba lô, D1) có kiểm thử riêng.
            const c = slot === 'back' && v !== 'S'
              ? changedOnTail(sp, st, v, { [slot]: id })
              : withoutOver(slot === 'back' ? id : null, () => changed(sp, st, v, { [slot]: id }));
            const onPet = c.body ?? c.onPet;
            const off = c.off ?? c.offPet;
            if (onPet || !off) bad.push(`${id} ${sp}/${st}/${v}: ${onPet} điểm đè lên pet, ${off} điểm lộ ra`);
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
    assert.equal(rig.wearInFront(slot, e, 'E', 'biped'), false, `${id}: phải vẽ dưới biped ở E`);
  }
  assert.equal(rig.wearInFront('head', rig.wearEntry('head', 'halo'), 'N'), false);
  assert.deepEqual(bad, []);
});

test('áo choàng, áo tơi trên thú bốn chân nhìn ngang (WEAR-SPEC D4): phủ lưng từ gáy, trên pet; S vẫn dưới pet', () => {
  const bad = [];
  const quads = ALL.filter((sp) => sp.body === 'quad');
  assert.ok(quads.length >= 10);
  for (const id of DRAPES) {
    const e = rig.wearEntry('back', id);
    assert.equal(e.drape, true, `${id}: thiếu cờ drape`);
    assert.equal(rig.wearInFront('back', e, 'E', 'quad'), true, `${id}: thú bốn chân nhìn ngang phải vẽ trên pet`);
    assert.equal(rig.wearInFront('back', e, 'S', 'quad'), false, `${id}: thú bốn chân nhìn trước vẫn vẽ dưới pet`);
    for (const sp of quads) {
      for (const st of ['baby', 'kid', 'adult']) {
        const sk = rig.skeleton(sp, st, 'E', {});
        const c = changed(sp.id, st, 'E', { back: id });
        // Phủ lưng: nhiều điểm đè lên pet, và cổ áo tới tận neo vai đã dời lên gáy (D4), không treo giữa lưng.
        if (c.onPet < (st === 'adult' ? 40 : 20)) bad.push(`${id} ${sp.id}/${st}/E: chỉ ${c.onPet} điểm phủ lưng`);
        if (c.x1 < Math.floor(sk.anchors.back[0])) bad.push(`${id} ${sp.id}/${st}/E: cổ áo dừng ở x ${c.x1}, trước neo vai ${sk.anchors.back[0].toFixed(1)}`);
        const w = changed(sp.id, st, 'W', { back: id });
        if (w.onPet !== c.onPet) bad.push(`${id} ${sp.id}/${st}/W khác E (${w.onPet} / ${c.onPet})`);
      }
    }
    // Không phải thú bốn chân: giữ lớp của món (dưới pet).
    for (const sp of ['boba', 'canh_cut', 'tho_la']) {
      const c = changedOnTail(sp, 'adult', 'E', { back: id });
      if (c.body) bad.push(`${id} ${sp}/adult/E: ${c.body} điểm đè lên thân`);
    }
  }
  assert.deepEqual(bad, []);
});

test('đồ lưng nhìn ngang nằm trên phần đuôi thò ra ngoài thân, không bao giờ trên thân; bùa vẫn nấp sau đuôi', () => {
  const bad = [];
  let overTail = 0;
  for (const sp of ALL.filter((s) => TAILS.tailFor(s) !== TAILS.TAILS.none)) {
    for (const st of ['kid', 'adult']) {
      // Ngoại lệ (index.js wearHidden): món vẽ dưới pet mà gần như khuất hết (dưới VISIBLE_MIN điểm, ví dụ ba lô, đèn lồng
      // trên cá chép rồng nhí nhố) thì vẽ trên pet; khi đó chỉ cần món hiện ra.
      for (const id of ['angel', 'batwings', 'backpack', 'cape']) {
        if (sp.body === 'quad' && DRAPES.includes(id)) continue;
        if (rig.wearHidden(sp.id, st, 'E', 'back', id)) continue;
        const c = changedOnTail(sp.id, st, 'E', { back: id });
        if (c.body) bad.push(`${id} ${sp.id}/${st}/E: ${c.body} điểm đè lên thân`);
        overTail += c.tail;
      }
      if (rig.wearHidden(sp.id, st, 'E', 'charm', 'lantern')) continue;
      const c = changedOnTail(sp.id, st, 'E', { charm: 'lantern' });
      if (c.tail || c.body) bad.push(`lantern ${sp.id}/${st}/E: bùa đè ${c.tail} điểm đuôi, ${c.body} điểm thân`);
    }
  }
  assert.ok(overTail > 100, `đồ lưng không phủ lên đuôi ở đâu cả (${overTail} điểm)`);
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
    const off = { cat: render('meo_bac', 'S'), catE: render('meo_bac', 'E'), boba: render('boba', 'S') };
    assert.ok(on.cat.some((c, k) => c !== off.cat[k]), 'tai mèo không được vẽ lại lên mũ chóp ở S');
    assert.ok(on.catE.every((c, k) => c === off.catE[k]), 'earsOver không được dùng ở E');
    assert.ok(on.boba.every((c, k) => c === off.boba[k]), 'earsOver chỉ cho tai mèo');
  } finally {
    HEAD.tophat.earsOver = true;
  }
});

// Luật đặt của 5 khe, tính lại ĐỘC LẬP từ dữ liệu (wear/data/*.js) và công thức trong bộ xem trước của họa sĩ (hw.py,
// common.py place_xy, neckprev.py render(), preview.py, wl.py), không gọi wear/stamp.js:
//   đầu (floor(x + .5), floor(y + .5)) + trễ của vầng hào quang; mặt theo ô mắt (2×3, mắt to 3×4) + pose.look ở S/E;
//   cổ floor(x + .5); lưng floor(x), floor(y); bùa pyRound + nhún 1 px khi tick % 4 ≥ 2, nâng lên khỏi mặt đất;
//   lưng và bùa không chạm mép trái/phải; "small" (đồ mặt: "big") cho sơ sinh và nhí nhố.
// Mọi điểm mà món làm đổi trong khung (so với khung đeo đúng món đó nhưng hàm vẽ rỗng, để đặc điểm bị giấu như nhau) phải
// là điểm của hình dán đã viền đặt đúng chỗ: đúng màu, hoặc #2e1d14 (mép cắt ở mặt đất, viền thân vẽ lên đồ lưng trên đuôi).
// Cằm che, tai mèo vẽ lại lên mũ, ống hút của Boba chỉ làm BỚT điểm đổi nên không cần ngoại lệ. Lệch 1 px là sai màu.
function pyRoundRef(v) {
  const f = Math.floor(v);
  const d = v - f;
  return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1;
}
async function wearRegistries() {
  const out = {};
  for (const [slot, name] of [['head', 'HEAD'], ['face', 'FACE'], ['neck', 'NECK'], ['back', 'BACK'], ['charm', 'CHARM']]) {
    out[slot] = (await import(`${GAME}rig2/wear/${slot}.js`))[name];
  }
  return out;
}
/** Hình dán đã viền và góc trên-trái của nó theo luật đặt của họa sĩ; null nếu hướng này không có hình. */
async function expectedStamp(slot, item, sk, view, stKey, pose = {}, tick = 0) {
  const core = await import(`${GAME}rig2/core.js`);
  const { outerOutline } = await import(`${GAME}rig2/wear/stamp.js`);
  const young = stKey === 'baby' || stKey === 'kid';
  const vn = slot === 'face' ? (young && item.big ? 'big' : 'views') : young && item.small ? 'small' : 'views';
  const vd = item[vn][view];
  if (!vd) return null;
  const raw = core.stamp(vd.rows, item.keys);
  const pic = slot === 'face' ? outerOutline(raw) : core.padOutline(raw);
  const [ax, ay] = sk.anchors[slot];
  let X;
  let Y;
  if (slot === 'face') {
    const [ew, eh] = young ? [3, 4] : [2, 3];
    X = (view === 'E' ? Math.floor(ax - ew / 2 + 0.5) : pyRoundRef(ax)) + (view === 'N' ? 0 : pose.look ?? 0);
    Y = Math.floor(sk.eyeY - eh / 2 + 0.5);
  } else if (slot === 'back') {
    [X, Y] = [Math.floor(ax), Math.floor(ay)];
  } else if (slot === 'charm') {
    [X, Y] = [pyRoundRef(ax), pyRoundRef(ay)];
  } else {
    [X, Y] = [Math.floor(ax + 0.5), Math.floor(ay + 0.5)];
    if (slot === 'head' && item.lag) Y += Math.min(item.lag, Math.max(0, -(pose.lift ?? 0)));
  }
  let x = X - vd.pivot[0] - 1;
  let y = Y - vd.pivot[1] - 1;
  if (slot === 'charm') {
    y = Math.min(y, pyRoundRef(sk.ground) - pic.h);
    if (tick % 4 >= 2) y += 1;
  }
  if (slot === 'back' || slot === 'charm') x = Math.min(Math.max(x, 1), 47 - pic.w);
  return { pic, x, y };
}
/** So một khung có món với khung "món rỗng": { bad: [điểm không giải thích được], exact: số điểm đúng màu hình dán }. */
function explain(got, ref, want) {
  const bad = [];
  let exact = 0;
  for (let k = 0; k < 48 * 48; k++) {
    const i = k * 4;
    if ([0, 1, 2, 3].every((c) => got[i + c] === ref[i + c])) continue;
    const sx = (k % 48) - want.x;
    const sy = Math.floor(k / 48) - want.y;
    const inside = sx >= 0 && sy >= 0 && sx < want.pic.w && sy < want.pic.h;
    const j = inside ? (sy * want.pic.w + sx) * 4 : -1;
    if (!inside || !want.pic.data[j + 3]) {
      bad.push(`(${k % 48},${Math.floor(k / 48)}) ngoài hình dán`);
      continue;
    }
    if ([0, 1, 2, 3].every((c) => got[i + c] === want.pic.data[j + c])) exact++;
    else if (!(got[i] === 0x2e && got[i + 1] === 0x1d && got[i + 2] === 0x14 && got[i + 3] === 255)) bad.push(`(${k % 48},${Math.floor(k / 48)}) sai màu`);
  }
  return { bad, exact };
}
/**
 * Khung có món `id` và khung cùng món nhưng hàm vẽ hình chính rỗng (cùng ctx.wear, cùng lớp; phần "over" D1 giữ nguyên
 * ở cả hai khung, vì nó có luật đặt riêng, xem kiểm thử phần "over").
 */
function renderPair(regs, slot, id, sp, st, v, pose, opts) {
  const got = rig.renderFrame(sp, st, v, pose, { [slot]: id }, { marks: false, ...opts }).img.data;
  const saved = regs[slot][id];
  const noop = () => {};
  regs[slot][id] = { ...saved, S: noop, E: noop, N: noop };
  try {
    return [got, rig.renderFrame(sp, st, v, pose, { [slot]: id }, { marks: false, ...opts }).img.data];
  } finally {
    regs[slot][id] = saved;
  }
}

test('luật đặt đồ đeo tính lại từ dữ liệu: 55 món × 4 loài mẫu × 6 giai đoạn × S/E/N, mắt liếc, bùa nhún, trễ của vầng hào quang', async () => {
  const regs = await wearRegistries();
  const problems = [];
  const exact = {};
  const check = async (slot, id, sp, st, v, pose = {}, opts = {}) => {
    const item = regs[slot][id].data;
    const sk = rig.skeleton(rig.speciesOf(sp), st, v, pose);
    const want = await expectedStamp(slot, item, sk, v, st, pose, opts.tick ?? 0);
    if (!want) return;
    const [got, ref] = renderPair(regs, slot, id, sp, st, v, pose, opts);
    const r = explain(got, ref, want);
    exact[id] = (exact[id] ?? 0) + r.exact;
    if (r.bad.length) problems.push(`${id} ${sp}/${st}/${v} ${JSON.stringify(pose)}: ${r.bad.length} điểm, ví dụ ${r.bad.slice(0, 3).join(' ')}`);
  };
  for (const [id, w] of Object.entries(WEARABLES)) {
    for (const sp of ['boba', 'meo_bac', 'canh_cut', 'tho_la']) {
      for (const st of STAGE_KEYS) for (const v of ['S', 'E', 'N']) await check(w.slot, id, sp, st, v, {}, { tick: w.slot === 'charm' && st === 'adult' ? 2 : 0 });
    }
  }
  for (const id of idsOf('face')) {
    for (const v of ['S', 'E', 'N']) for (const look of [-1, 1]) for (const st of ['baby', 'adult']) await check('face', id, 'meo_bac', st, v, { look });
  }
  for (const id of ['halo', 'crown', 'tophat']) {
    for (const lift of [-3, -6]) for (const v of ['S', 'E']) await check('head', id, 'boba', 'adult', v, { lift }, { fit: false });
  }
  assert.deepEqual(problems, []);
  for (const id of Object.keys(WEARABLES)) assert.ok(exact[id] > 0, `${id}: không thấy điểm nào của hình dán`);
});

test('nhảy: món đội đầu lên cùng đầu (không bị đẩy xuống), vầng hào quang trễ 2 px và vẫn lơ lửng; khung nhảy vừa ô', () => {
  const topRow = (img) => {
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (img[(y * 48 + x) * 4 + 3]) return y;
    return 48;
  };
  // Hàng trên cùng của riêng món (so với khung không đội gì), khi không hạ cú nhảy (fit: false); Boba nhí nhố: món
  // còn trong ô cả ở lift −6.
  const itemTop = (id, lift) => {
    const bare = rig.renderFrame('boba', 'kid', 'S', { lift }, {}, { marks: false, fit: false }).img.data;
    const got = rig.renderFrame('boba', 'kid', 'S', { lift }, { head: id }, { marks: false, fit: false }).img.data;
    for (let k = 0; k < 48 * 48; k++) if ([0, 1, 2, 3].some((c) => got[k * 4 + c] !== bare[k * 4 + c])) return Math.floor(k / 48);
    return 48;
  };
  assert.ok(itemTop('halo', -6) >= 1, 'hào quang ra khỏi ô: chọn khung thấp hơn cho phép thử');
  assert.equal(itemTop('crown', 0) - itemTop('crown', -3), 3);
  assert.equal(itemTop('crown', 0) - itemTop('crown', -6), 6);
  assert.equal(itemTop('halo', 0) - itemTop('halo', -3), 1, 'hào quang trễ 2 px ở lift −3');
  assert.equal(itemTop('halo', 0) - itemTop('halo', -6), 4, 'hào quang trễ 2 px ở lift −6');
  // Đỉnh cú nhảy, có hạ cú nhảy cho vừa ô: mũ cách neo đầu đúng như lúc đứng, vòng hào quang còn hở trên đầu.
  for (const sp of ['canh_cut', 'boba', 'tho_la', 'meo_bac']) {
    for (const id of ['tophat', 'nonla', 'lotus', 'halo', 'crown']) {
      const run = rig.renderAnim(sp, 'adult', 'jump', 'S', { head: id }, { marks: false });
      const bare = rig.renderAnim(sp, 'adult', 'jump', 'S', {}, { marks: false });
      const rest = topRow(run.frames[0].img.data) - Math.floor(run.frames[0].anchors.head[1] + 0.5);
      run.frames.forEach((f, i) => {
        assert.ok(topRow(f.img.data) >= 1, `${id} ${sp} khung ${i}: chạm mép trên`);
        const off = topRow(f.img.data) - Math.floor(f.anchors.head[1] + 0.5);
        if (id !== 'halo') assert.equal(off, rest, `${id} ${sp} khung ${i}: mũ bị đẩy lệch khỏi đầu (${off} / ${rest})`);
        else assert.ok(off - rest <= 2, `halo ${sp} khung ${i}: trễ ${off - rest} px`);
      });
      if (id === 'halo') {
        // Ở đỉnh cú nhảy vòng hào quang vẫn cách đỉnh đầu (khung không đội gì) ít nhất 1 hàng trống... trên Boba và cánh cụt.
        if (sp === 'boba' || sp === 'canh_cut') {
          const apex = run.frames[2];
          const head = topRow(bare.frames[2].img.data) + (Math.floor(apex.anchors.head[1] + 0.5) - Math.floor(bare.frames[2].anchors.head[1] + 0.5));
          const haloRows = [];
          for (let y = 0; y < head; y++) if ([...Array(48).keys()].some((x) => apex.img.data[(y * 48 + x) * 4 + 3])) haloRows.push(y);
          assert.ok(haloRows.length && haloRows.at(-1) < head - 1, `halo ${sp}: vòng chạm đầu ở đỉnh cú nhảy (${haloRows.at(-1)} / ${head})`);
        }
      }
    }
  }
});

test('ctx.headTopCovered: chỉ món đội đầu che đỉnh đầu (không phải vầng hào quang, hoa cài, nơ)', () => {
  const sk = rig.skeleton('tho_la', 'adult', 'S', {});
  const sp = rig.speciesOf('tho_la');
  const covered = (wear) => rig.makeCtx(sp, sk.st, sk, 'S', {}, wear).headTopCovered;
  assert.equal(covered({}), false);
  for (const id of idsOf('head')) assert.equal(covered({ head: id }), !['halo', 'flower', 'bow'].includes(id), id);
  assert.equal(covered({ face: 'glasses' }), false);
});

test('móc của dáng khung (bước ghép): cá nóc và ếch nảy cao khi đi; cổ dáng tròn theo khối, cách đất ≥ 6 px; rồng không vẽ đuôi của tails.js', () => {
  const hop = (id) => rig.animPoses(rig.speciesOf(id), 'walk', 'S').map((p) => p.lift ?? 0);
  assert.deepEqual(hop('ca_noc'), [0, -2, -1, 0, -2, -1]);
  assert.deepEqual(hop('ech_sen'), [0, -2, -1, 0, -2, -1]);
  assert.deepEqual(hop('heo_than'), [0, -1, 0, 0, -1, 0]);
  assert.deepEqual(hop('boba'), [0, -1, 0, 0, -1, 0]);
  for (const id of ['chuot_chuong', 'heo_than', 'ca_noc']) {
    for (const st of ['baby', 'kid', 'adult']) {
      for (const v of ['S', 'E', 'N']) {
        const sk = rig.skeleton(rig.speciesOf(id), st, v, {});
        assert.ok(sk.anchors.neck[1] <= sk.ground - 6 + 1e-9, `${id}/${st}/${v}: cổ ${sk.anchors.neck[1].toFixed(2)} sát đất`);
      }
    }
  }
  // Rồng tự vẽ đuôi (ownsTail): đổi kiểu đuôi trong dữ liệu không đổi điểm ảnh nào (index.js bỏ qua parts/tails.js).
  assert.ok(rig.archetypeOf(rig.speciesOf('thanh_long')).ownsTail);
  for (const id of ['thanh_long', 'ca_chep_rong', 'ky_nhong']) {
    const sp = rig.speciesOf(id);
    for (const v of ['S', 'E', 'N']) {
      const a = rig.renderFrame(sp, 'adult', v, {}, {}, { marks: false }).img.data;
      const b = rig.renderFrame({ ...sp, tail: 'fluffy' }, 'adult', v, {}, {}, { marks: false }).img.data;
      assert.ok(a.every((c, k) => c === b[k]), `${id}/${v}: đuôi của tails.js lọt vào dáng rồng`);
    }
  }
});

/** Điểm neo nhìn ngang của skeleton.js khi chưa áp móc `anchors` của dáng khung. */
function anchorsBeforeHook(sp, stage) {
  const arch = rig.archetypeOf(sp);
  const hook = arch.anchors;
  arch.anchors = undefined;
  try {
    return rig.skeleton(sp, stage, 'E', {}).anchors;
  } finally {
    arch.anchors = hook;
  }
}

test('điểm neo đồ đeo: bùa E ngoài cả đầu (WEAR-SPEC D6), lưng E của thú bốn chân dời lên vai (D4)', () => {
  for (const sp of ALL) {
    for (const st of LIFE_STAGES) {
      const sk = rig.skeleton(sp, st.key, 'E', {});
      const [bcx, , brx] = sk.body;
      const [hcx, , hrx] = sk.head;
      assert.ok(Math.abs(sk.anchors.charm[0] - (Math.min(bcx - brx, hcx - hrx) - 2.5)) < 1e-9, `${sp.id}/${st.key}: neo bùa E`);
      const old = bcx - brx * 0.45;
      const want = sp.body === 'quad' ? Math.max(old, hcx - hrx * 0.8) : old;
      // Dáng có móc `anchors` (tròn: lưng trên mép sau thật của khối; rồng: lùi về sau) thì skeleton.js dùng kết quả của móc.
      const arch = rig.archetypeOf(sp);
      if (arch.anchors) {
        const hooked = arch.anchors({ ...sk, anchors: anchorsBeforeHook(sp, st.key) }, sp);
        assert.deepEqual(sk.anchors.back, hooked.back, `${sp.id}/${st.key}: neo lưng E theo móc của dáng`);
        assert.ok(sk.anchors.back[0] <= want + 1e-9 || sp.body === 'round', `${sp.id}/${st.key}: neo lưng E không tiến lên trước`);
      } else assert.ok(Math.abs(sk.anchors.back[0] - want) < 1e-9, `${sp.id}/${st.key}: neo lưng E`);
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
  // khóa vàng 2 × 6, cột x − 6, x − 5 và hàng y − 3 .. y + 2 của neo cổ (S: over đặt theo neo cổ, ngay dưới cằm)
  data.views.S.over = { pivot: [6, 3], rows: ['YY', 'YY', 'YY', 'YY', 'YY', 'YY'] };
  BACK.backpack = dataEntry('back', 'backpack', data);
  try {
    rig.clearWearIcons();
    const plain = changed('boba', 'adult', 'S', { back: 'batwings' });
    assert.equal(plain.onPet, 0);
    const c = changed('boba', 'adult', 'S', { back: 'backpack' });
    assert.ok(c.onPet >= 8, `over phải đè lên ngực pet (${c.onPet} điểm)`);
    const [ax, ay] = rig.skeleton('boba', 'adult', 'S', {}).anchors.neck;
    const got = rig.renderFrame('boba', 'adult', 'S', {}, { back: 'backpack' }, { marks: false }).img.data;
    const bare = rig.renderFrame('boba', 'adult', 'S', {}, {}, { marks: false }).img.data;
    const px = (img, x, y) => [...img.subarray((y * 48 + x) * 4, (y * 48 + x) * 4 + 4)].join();
    const [x, y] = [Math.floor(ax + 0.5) - 6, Math.floor(ay + 0.5) - 3];
    assert.equal(px(got, x, y), px(bare, x, y), 'cằm phải che phần over');
    assert.notEqual(px(got, x, y + 4), px(bare, x, y + 4), 'over dưới cằm phải hiện (trước ngực, trên thân pet)');
    assert.ok(rig.wearIcon('backpack'), 'hình túi đồ của món có over');
  } finally {
    BACK.backpack = saved;
    rig.clearWearIcons();
  }
  // Khóa áo choàng, quai ba lô (bước ghép): nhìn trước hiện ngay dưới cằm cả trên thân tròn to và dáng rồng, nơi phần
  // chính của món (dải ló quanh người) bị thân che hết.
  for (const id of ['cape', 'wavecape', 'starcape', 'aotoi', 'backpack']) {
    assert.ok(BACK[id].over, `${id}: thiếu phần over nhìn trước`);
    for (const sp of ['chuot_chuong', 'heo_than', 'thanh_long', 'meo_bac']) {
      for (const st of ['baby', 'adult']) {
        const c = changed(sp, st, 'S', { back: id });
        assert.ok(c.onPet >= 8, `${id} ${sp}/${st}/S: khóa / quai chỉ ${c.onPet} điểm trước ngực`);
      }
    }
  }
});

test('wearIcon / wearImage: hình túi đồ là đúng hình dán đã viền ở hướng `icon` của món (mặc định S), cỡ 1x; chốt = điểm đặt trên pet', async () => {
  const core = await import(`${GAME}rig2/core.js`);
  const { outerOutline } = await import(`${GAME}rig2/wear/stamp.js`);
  const want = (slot, item, v) => {
    const vd = item.views[v];
    const raw = core.stamp(vd.rows, item.keys);
    const pic = slot === 'face' ? outerOutline(raw) : core.padOutline(raw);
    const b = core.bbox(pic);
    return { img: core.crop(pic, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1), pivot: [vd.pivot[0] + 1 - b.x0, vd.pivot[1] + 1 - b.y0] };
  };
  const views = {};
  for (const slot of ['head', 'face', 'neck', 'back', 'charm']) {
    const DATA = (await import(`${GAME}rig2/wear/data/${slot}.js`)).default;
    for (const [id, item] of Object.entries(DATA)) {
      views[id] = item.icon ?? 'S';
      for (const [v, icon] of [[views[id], rig.wearIcon(id)], ['S', rig.wearIcon(id, { view: 'S' })]]) {
        const w = want(slot, item, v);
        assert.ok(icon, `${id}: không có hình túi đồ`);
        assert.equal(icon.view, v, `${id}: hướng hình`);
        assert.deepEqual([icon.img.w, icon.img.h], [w.img.w, w.img.h], `${id}/${v}: cỡ hình`);
        assert.ok(icon.img.data.every((c, k) => c === w.img.data[k]), `${id}/${v}: hình túi đồ khác hình dán`);
        // Chốt của hình = chỗ chốt của hình dán rơi khi vẽ lên Boba (bé khách mời Petdex đặt món theo chốt này).
        assert.deepEqual(icon.pivot, w.pivot, `${id}/${v}: chốt của hình túi đồ`);
        assert.deepEqual(icon.lean, { side: 0, dx: 0 }, `${id}: hình dữ liệu không lệch theo bề ngang đầu`);
      }
    }
  }
  // Món mà hình S chỉ là dải ló ra quanh người lấy hình N (thấy cả món); còn lại hình S.
  const N = Object.keys(views).filter((id) => views[id] === 'N').sort();
  assert.deepEqual(N, ['aotoi', 'backpack', 'cape', 'scarf', 'starcape', 'wavecape']);
  assert.ok(Object.values(views).every((v) => v === 'S' || v === 'N'));
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

// Mọi món phải hiện ra (ít nhất VISIBLE_MIN điểm khác khung để trống) ở S và E (W = E lật) trên cả 51 loài, sơ sinh,
// nhí nhố và trưởng thành: bé đi bộ trong công viên dùng E/W. Chạy lại sau MỖI nhánh vẽ dáng khung, đuôi, tai, đặc điểm
// được gộp: thân tròn to hay đuôi xù mới có thể che hết một món (đồ lưng ở S chỉ là dải ló ra quanh người). Khi đó quyết
// từng trường hợp (vẽ thêm phần "over" D1, chỉnh neo trong skeleton.js...), đừng hạ ngưỡng.
const VISIBLE_MIN = 8;
test(`khói: món nào đang đeo cũng hiện ra (≥ ${VISIBLE_MIN} điểm) ở S và E trên 51 loài × sơ sinh/nhí nhố/trưởng thành`, () => {
  const low = [];
  for (const sp of ALL) {
    for (const st of ['baby', 'kid', 'adult']) {
      for (const v of ['S', 'E']) {
        const bare = rig.renderFrame(sp, st, v, {}, {}, { marks: false }).img.data;
        for (const [id, w] of Object.entries(WEARABLES)) {
          const got = rig.renderFrame(sp, st, v, {}, { [w.slot]: id }, { marks: false }).img.data;
          let n = 0;
          for (let k = 0; k < 48 * 48; k++) if ([0, 1, 2, 3].some((c) => got[k * 4 + c] !== bare[k * 4 + c])) n++;
          if (n < VISIBLE_MIN) low.push(`${id} trên ${sp.id}/${st}/${v}: ${n} điểm`);
        }
      }
    }
  }
  assert.deepEqual(low, []);
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

// WEAR-SPEC D5 (chờ chủ dự án duyệt dải navy): mũ lưỡi trai dùng đúng 3 màu của dải 'navy' mà cánh cụt dùng cho lông, nên
// trên cánh cụt mũ chỉ tách khỏi đầu nhờ đường viền. Khi dải navy thật được duyệt, đổi màu cánh cụt (hoặc dời mũ sang các
// bậc xanh nhạt hơn) rồi bỏ `todo` để khóa lại.
test('tương phản (D5): mũ lưỡi trai và kính râm không trùng màu lông của cánh cụt', { todo: 'chờ WEAR-SPEC D5 (dải navy)' }, async () => {
  const { SPECIES_RAMPS } = await import(`${GAME}rig2/ramps.js`);
  const fur = new Set(rig.RAMPS[SPECIES_RAMPS.canh_cut.main].slice(1));
  for (const [slot, id] of [['head', 'cap'], ['face', 'shades']]) {
    const item = (await import(`${GAME}rig2/wear/data/${slot}.js`)).default[id];
    const shared = Object.values(item.keys).filter((c) => fur.has(c));
    assert.deepEqual(shared, [], `${id} dùng màu lông cánh cụt: ${shared.join(' ')}`);
  }
});
