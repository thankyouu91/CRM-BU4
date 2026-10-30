// Kiểm thử pet ngũ hành bước 2.5A: danh sách loài, đồ đeo 4 khe, chuyển phụ kiện cũ, Chợ Phiên tháo đồ đang đeo.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PETDEX_DB = ':memory:';
const store = await import('../server/db.js');
const { DAY, ITEMS, describePet } = await import('../server/game.js');
const { post } = await import('../server/ledger.js');
const { migrate } = await import('../server/migrate.js');
const { listSpecies, getSpecies } = await import('../server/species.js');
const bazaar = await import('../server/bazaar.js');
const gear = await import('../server/gear.js');
const { ELEMENTS, LIFE_STAGES, SLOTS, SPECIES, WEARABLES, elementOfSpecies, relation, speciesStats } = await import('../../public/ta-tua/game/js/shared/pets.js');

const T0 = Date.parse('2026-11-02T03:00:00Z');

test('50 loài: mỗi hành 10 loài, đủ 4 độ hiếm, số liệu hợp lệ', () => {
  assert.equal(SPECIES.length, 50);
  assert.equal(new Set(SPECIES.map((s) => s.id)).size, 50, 'mã loài không trùng');
  for (const el of Object.keys(ELEMENTS)) {
    const list = SPECIES.filter((s) => s.element === el);
    assert.equal(list.length, 10, el);
    assert.deepEqual(['thuong', 'hiem', 'quy', 'huyenthoai'].map((r) => list.filter((s) => s.rarity === r).length), [5, 3, 1, 1]);
  }
  for (const sp of SPECIES) {
    const st = speciesStats(sp);
    assert.ok(Object.values(st.skills).every((v) => v > 0 && v < 40), sp.id);
    assert.ok(st.lifespan >= 90 && st.lifespan <= 130, sp.id);
  }
  assert.equal(LIFE_STAGES.length, 6);
});

test('tương sinh, tương khắc theo ngũ hành', () => {
  assert.equal(relation('thuy', 'moc'), 'feeds'); // Thủy sinh Mộc
  assert.equal(relation('moc', 'moc'), 'same');
  assert.equal(relation('kim', 'moc'), 'beats'); // Kim khắc Mộc
  assert.equal(relation('moc', 'hoa'), 'feeds');
  assert.equal(relation('hoa', 'moc'), 'drains');
});

test('danh sách loài: linh vật Boba và 50 loài vẽ bằng bộ khung; chỉ loài Thường nhận nuôi trực tiếp', () => {
  const list = listSpecies();
  const boba = list.find((s) => s.id === 'boba');
  assert.ok(boba.rig && boba.mascot && !boba.guest && boba.adoptable && boba.element === 'thuy', 'Boba vẽ bằng bộ khung, không dùng ảnh Petdex');
  assert.equal(list.filter((s) => s.guest && s.id === 'boba').length, 0);
  assert.equal(list.filter((s) => s.rig && !s.mascot).length, 50);
  assert.equal(list.filter((s) => s.rig && !s.mascot && s.adoptable).length, 25);
  assert.equal(getSpecies('bach_ho').adoptable, false);
  assert.equal(elementOfSpecies('chu_tuoc'), 'hoa');
  assert.equal(elementOfSpecies('boba'), 'thuy');
});

test('đồ đeo: mỗi món trong cửa hàng có hình và khe, mỗi khe một món', () => {
  for (const item of Object.values(ITEMS).filter((i) => i.type === 'accessory')) {
    assert.ok(WEARABLES[item.id], `${item.id} chưa có hình`);
    assert.ok(SLOTS[item.slot], item.id);
    assert.equal(item.element, WEARABLES[item.id].element);
  }
  for (const id of Object.keys(WEARABLES)) assert.ok(ITEMS[id], `${id} chưa bán ở cửa hàng`);

  migrate(T0);
  const userId = store.createUser('wear', 'x', T0 - 10 * DAY);
  post({ userId, delta: 5000, kind: 'opening', now: T0 });
  const petId = store.insertPet(userId, 'Bé', 'cao_lua', T0);
  store.setWear(petId, 'head', 'nonla');
  store.setWear(petId, 'neck', 'scarf');
  store.setWear(petId, 'back', 'cape');
  store.setWear(petId, 'head', 'crown'); // đổi món cùng khe
  const pet = describePet(store.getPet(petId), T0);
  assert.deepEqual(pet.wear, { head: 'crown', neck: 'scarf', back: 'cape' });
  assert.equal(pet.element, 'hoa');
  store.setWear(petId, 'neck', null);
  assert.deepEqual(store.wearOf(petId), { head: 'crown', back: 'cape' });
  store.setWear(petId, null, null);
  assert.deepEqual(store.wearOf(petId), {});
});

test('chuyển phụ kiện cũ sang khe; bán món đang đeo ở Chợ Phiên thì bé tự tháo', () => {
  const userId = store.createUser('legacy', 'x', T0 - 10 * DAY);
  post({ userId, delta: 5000, kind: 'opening', now: T0 });
  const petId = store.insertPet(userId, 'Cũ', 'boba', T0);
  store.db.prepare("UPDATE pets SET accessory = 'glasses' WHERE id = ?").run(petId);
  store.db.prepare("DELETE FROM meta WHERE key = 'migrated_wear_v1'").run();
  migrate(T0);
  assert.deepEqual(store.wearOf(petId), { face: 'glasses' });

  // trang phục có cấp: món đang có thành bản Xanh lam, bé đeo đúng bản đó
  store.addItem(userId, 'glasses', 1);
  store.db.prepare("DELETE FROM meta WHERE key = 'migrated_gear_v1'").run();
  migrate(T0);
  const [g] = gear.listGear(userId);
  assert.equal(g.itemId, 'glasses');
  assert.equal(g.tier, 'blue');
  assert.equal(Object.keys(g.affixes).length, 1);
  assert.equal(g.wornBy, petId);
  assert.equal(store.inventory(userId).glasses ?? 0, 0, 'phụ kiện không còn nằm trong túi đồ thường');

  assert.throws(() => bazaar.listForSale(userId, { kind: 'item', ref: 'glasses', price: 120 }, T0), /từng món/);
  bazaar.listForSale(userId, { kind: 'gear', ref: String(g.id), price: 120 }, T0);
  assert.deepEqual(store.wearOf(petId), {}, 'bày bán món đang đeo thì bé tự tháo');
});

// ---------------------------------------------------------------- bước 2.5B: ngũ hành trong luật chơi

const { tick, useItem, ITEMS: ALL_ITEMS } = await import('../server/game.js');
const elements = await import('../server/elements.js');
const eggs = await import('../server/eggs.js');
const { EGG, ELEMENT_RULES, fortuneOf, fullSetOf, setOf, wearBonus, statsOfSpecies } = await import('../../public/ta-tua/game/js/shared/pets.js');
const { HOUR } = await import('../server/game.js');

const basePet = (species, extra = {}) => ({
  id: 1, name: 'Bé', species, level: 1, xp: 0, fullness: 90, happiness: 90, energy: 50, hygiene: 90, health: 80,
  traits: [], wear: {}, born_at: 0, updated_at: 0, ...extra,
});

test('chỉ số theo loài: Thổ đói chậm, Hỏa hồi năng lượng nhanh, Thủy vui lâu', () => {
  const after = (species) => tick(basePet(species), 5 * HOUR);
  assert.ok(after('heo_dat').fullness > after('cao_lua').fullness, 'Thổ đói chậm hơn Hỏa');
  const rested = (species) => tick(basePet(species), 2 * HOUR).energy; // 2 giờ để chưa chạm trần 100
  assert.ok(rested('cao_lua') > rested('rai_ca'), 'Hỏa hồi năng lượng nhanh hơn');
  assert.ok(after('rai_ca').happiness > after('cao_lua').happiness, 'Thủy vui lâu hơn');
  assert.equal(after('test_pet').fullness, tick(basePet('test_pet'), 5 * HOUR).fullness, 'loài lạ trung tính');
});

test('hợp mệnh: kỹ năng lên theo sở trường của loài và bộ đồ; đủ bộ cùng hành thì +5% lương', () => {
  const kim = basePet('meo_bac');
  assert.ok(elements.skillFactor(kim, 'craft') > elements.skillFactor(kim, 'charm'), 'Kim lên Khéo tay nhanh');
  const dressed = { ...kim, wear: { head: 'nonla', face: 'woodglasses', neck: 'bowtie', back: 'cape' } }; // bộ Thổ, Thổ sinh Kim
  assert.equal(fullSetOf(dressed.wear), 'tho');
  assert.ok(Math.abs(wearBonus(dressed.wear, 'kim') - ELEMENT_RULES.wearCap) < 1e-9, 'bốn món tương sinh: +40% thô, chạm trần +30%');
  assert.ok(Math.abs(wearBonus({ head: 'nonla', neck: 'bowtie' }, 'kim') - 0.2) < 1e-9, 'dưới trần thì cộng đủ');
  assert.ok(elements.skillFactor(dressed, 'craft') > elements.skillFactor(kim, 'craft'));
  const clash = { ...kim, wear: { head: 'bow', face: 'heartglasses', neck: 'scarf', back: 'dragonwings' } }; // Hỏa khắc Kim
  assert.ok(elements.skillFactor(clash, 'craft') < elements.skillFactor(kim, 'craft'), 'đồ kỵ mệnh làm chậm');
  // Tìm một ngày hành Kim không vượng để so lương: đủ bộ +5%.
  let day = Date.parse('2026-11-02T03:00:00Z');
  while (fortuneOf(new Date(day + 7 * HOUR).toISOString().slice(0, 10)) === 'kim') day += 24 * HOUR;
  assert.equal(elements.elementPay(kim, day), 1);
  assert.ok(Math.abs(elements.elementPay(dressed, day) - 1.05) < 1e-9);
  // Bộ tính theo số món cùng hành: bé dưới cấp 30 (đeo 3 món) vẫn có bộ 3 món.
  const three = { ...kim, wear: { head: 'nonla', face: 'woodglasses', neck: 'bowtie' } };
  assert.deepEqual(setOf(three.wear), { element: 'tho', count: 3, pay: 0.03 });
  assert.ok(Math.abs(elements.elementPay(three, day) - 1.03) < 1e-9);
  const five = { ...kim, wear: { ...dressed.wear, charm: 'gourd' } };
  assert.ok(Math.abs(elements.elementPay(five, day) - 1.08) < 1e-9);
  assert.equal(setOf({ head: 'nonla', face: 'woodglasses', neck: 'pearls', back: 'wavecape' }), null, 'hai hành mỗi hành 2 món: không thành bộ');
});

test('vận khí ngày: mỗi hành vượng một ngày trong vòng 5 ngày, bé hành đó thêm XP', () => {
  const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map(fortuneOf);
  assert.equal(new Set(days).size, 5);
  const day = Date.parse('2026-11-02T03:00:00Z');
  const lucky = { thuy: 'rai_ca', moc: 'tho_la', hoa: 'cao_lua', tho: 'heo_dat', kim: 'meo_bac' }[fortuneOf('2026-11-02')];
  assert.equal(elements.xpFactor(basePet(lucky), day), 1.1);
  assert.equal(elements.xpFactor(basePet('test_pet'), day), 1);
});

test('đồ ăn có hành: món hợp mệnh thêm 20% XP', () => {
  const thuy = basePet('rai_ca', { fullness: 30 });
  const plain = basePet('test_pet', { fullness: 30 });
  assert.equal(useItem(thuy, ALL_ITEMS.fish).xp, Math.round(ALL_ITEMS.fish.xp * 1.2), 'cá (Thủy) cho bé Thủy');
  assert.equal(useItem(plain, ALL_ITEMS.fish).xp, ALL_ITEMS.fish.xp);
});

test('trứng ngũ hành: ấp giữ ô nuôi, đủ 24 giờ mới nở, nở ra đúng hành với kỹ năng theo loài', () => {
  const userId = store.createUser('egg', 'x', T0 - 10 * DAY);
  post({ userId, delta: 5000, kind: 'opening', now: T0 });
  eggs.createPet(userId, 'Một', 'tho_la', T0);
  store.addItem(userId, 'egg_hoa', 1);
  store.addItem(userId, 'egg_kim', 1);
  let x = 3;
  const rand = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  eggs.incubate(userId, 'egg_hoa', T0, rand);
  eggs.incubate(userId, 'egg_kim', T0, rand);
  assert.equal(store.inventory(userId).egg_hoa ?? 0, 0);
  store.addItem(userId, 'egg_moc', 1);
  eggs.createPet(userId, 'Hai', 'cun_co', T0);
  assert.throws(() => eggs.incubate(userId, 'egg_moc', T0, rand), /ô nuôi/, '2 bé + 2 trứng = đủ 4 ô');
  const [egg] = eggs.eggsView(userId, T0);
  assert.throws(() => eggs.hatch(userId, egg.id, 'Sớm', T0 + HOUR), /chưa đủ/);
  const out = eggs.hatch(userId, egg.id, 'Lửa', T0 + EGG.hours * HOUR, rand);
  const pet = store.listPets(userId).find((p) => p.name === 'Lửa');
  assert.equal(pet.species, out.hatched.species);
  assert.equal(SPECIES.find((s) => s.id === pet.species).element, egg.element);
  const st = statsOfSpecies(pet.species);
  for (const [k, v] of Object.entries(store.skillsOf(pet.id))) {
    assert.ok(v === st.skills[k] || (k === 'charm' && v === st.skills[k] + 5), `kỹ năng ${k} theo loài`);
  }
  assert.throws(() => eggs.hatch(userId, egg.id, 'Lại', T0 + 2 * EGG.hours * HOUR), GameErrorLike);
});

function GameErrorLike(err) {
  return err instanceof Error && /trứng/.test(err.message);
}

// ---------------------------------------------------------------- bước 2.5C: giai đoạn đời và vòng đời

const jobs = await import('../server/jobs.js');
const life = await import('../server/lifecycle.js');
const { LIFE, LIFE_STAGES: STAGES6, seniorityBonus } = await import('../../public/ta-tua/game/js/shared/pets.js');

test('giai đoạn đời: nhí nhố làm 2 giờ lương 60%, thiếu niên 4 giờ; thâm niên tới +30%', () => {
  const userId = store.createUser('ages', 'x', T0 - 10 * DAY);
  post({ userId, delta: 1000, kind: 'opening', now: T0 });
  const kid = store.insertPet(userId, 'Nhí', 'test_pet', T0 - 3 * DAY); // 3 tuần
  const adult = store.insertPet(userId, 'Lớn', 'test_pet', T0 - 45 * DAY); // 45 tuần
  for (const id of [kid, adult]) store.savePet({ ...store.getPet(id), fullness: 90, energy: 100, updated_at: T0 });
  assert.throws(() => jobs.startShift(userId, { petId: kid, career: 'barista', hours: 4 }, T0), /tối đa 2 giờ/);
  const k = jobs.startShift(userId, { petId: kid, career: 'barista', hours: 2 }, T0);
  const a = jobs.startShift(userId, { petId: adult, career: 'barista', hours: 2 }, T0);
  const pay = (msg) => Number(/nhận (\d+)/.exec(msg)[1]);
  assert.ok(Math.abs(pay(k.message) / pay(a.message) - 0.6) < 0.05, 'nhí nhố lương 60%');
  assert.equal(STAGES6.find((s) => s.key === 'teen').rules.maxHours, 4);
  assert.equal(seniorityBonus(0), 0);
  assert.equal(seniorityBonus(55), 0.05);
  assert.equal(seniorityBonus(1000), LIFE.seniorityMax);
});

test('vòng đời: hết tuổi thọ thì về với sao trời, lập bia, khóa ô, kỷ vật cho bé sau; bé cuối thì được trứng', () => {
  const userId = store.createUser('life', 'x', T0 - 400 * DAY);
  post({ userId, delta: 10_000, kind: 'opening', now: T0 });
  const old = eggs.createPet(userId, 'Cụ', 'heo_dat', T0 - 120 * DAY).petId; // 120 tuần: quá tuổi thọ
  const young = eggs.createPet(userId, 'Cháu', 'tho_la', T0 - 10 * DAY).petId;
  store.setActivePet(userId, old);
  // Ca làm chưa nhận lương: bé mất thì lương vẫn về ví chủ.
  store.db.prepare(`INSERT INTO shifts (user_id, pet_id, career, rank, hours, pay, day, starts_at, ends_at)
    VALUES (?, ?, 'porter', 1, 1, 33, '2026-11-01', ?, ?)`).run(userId, old, T0 - 3 * HOUR, T0 - 2 * HOUR);
  const before = store.getUser(userId).coins;
  assert.ok(describePet(store.getPet(old), T0).life.warn, 'bé già được báo trước');
  life.settleLifeDay('2026-11-02');
  assert.equal(store.getPet(old), undefined, 'bé đã về với sao trời');
  assert.equal(store.getUser(userId).coins, before + 33, 'trả nốt lương ca cuối');
  assert.equal(store.getUser(userId).active_pet_id, young, 'bé chính chuyển sang bé còn lại');
  const [m] = life.memorialsView(userId);
  assert.equal(m.name, 'Cụ');
  assert.equal(m.heirloom, 'craft', 'kỷ vật là sở trường của Heo Đất');
  assert.equal(life.slotsOf(userId).locked, 1, 'ô của bé cũ thành ô tưởng niệm');
  assert.ok(life.recentMemorials(userId, T0 + DAY).length === 1);

  // Kỷ vật: bé kế tiếp được +5 Khéo tay.
  const next = eggs.createPet(userId, 'Mới', 'tho_la', T0 + DAY);
  assert.equal(next.heirloom.skill, 'craft');
  assert.equal(store.skillsOf(next.petId).craft, statsOfSpecies('tho_la').skills.craft + LIFE.heirloom);

  // Mở lại ô tưởng niệm tốn 3.000 xu.
  const coins = store.getUser(userId).coins;
  life.reopenSlot(userId, T0 + DAY);
  assert.equal(store.getUser(userId).coins, coins - LIFE.reopenCost);
  assert.equal(life.slotsOf(userId).locked, 0);
  assert.throws(() => life.reopenSlot(userId, T0 + DAY), /Không có ô/);

  // Bé cuối cùng mất: không khóa ô, được một trứng Thường nở sau 3 ngày.
  const solo = store.createUser('solo', 'x', T0 - 400 * DAY);
  eggs.createPet(solo, 'Một mình', 'rai_ca', T0 - 120 * DAY);
  life.settleLifeDay('2026-11-02');
  assert.equal(store.listPets(solo).length, 0);
  assert.equal(life.slotsOf(solo).locked, 0);
  const [egg] = eggs.eggsView(solo, T0);
  assert.equal(egg.element, 'thuy');
  assert.ok(egg.hatchAt - egg.startedAt === LIFE.memorialEggDays * DAY);
});
