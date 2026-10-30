// Chuyển dữ liệu cũ sang mô hình mới. Mỗi bước chạy đúng một lần (đánh dấu trong bảng meta).
import { adminLog, allPets, allUsers, db, getMeta, setBornAt, setMeta, setSkill, setTraits, setWear, skillsOf, transaction } from './db.js';
import { HOUR, ITEMS, PET_DAY_MS } from './game.js';
import { post } from './ledger.js';
import { initialSkills } from './rules/careers.js';
import { createGear, setGearListed, wearLimitOf, wornGear } from './gear.js';
import { TIER_ORDER } from '../../public/ta-tua/game/js/shared/gear.js';
import { mergeHeld, mergeIndustries } from './industry-merge.js';
import { closeHeavyIndustries, heavyOpen } from './heavy-industry.js';
import { rollTraits } from './rules/production.js';
import { TREASURY_SEED } from './rules/town.js';

const insertOpening = db.prepare(`
  INSERT INTO ledger (user_id, account, delta, balance_after, kind, memo, created_at)
  VALUES (?, 'wallet', ?, ?, 'opening', 'Số dư khi mở sổ cái', ?)`);
const hasLedger = db.prepare('SELECT 1 FROM ledger WHERE user_id = ? LIMIT 1');

/** Mốc giai đoạn cũ (1 giờ = 1 ngày tuổi) để giữ nguyên giai đoạn khi đổi nhịp tuổi. */
const OLD_STAGE_DAYS = [0, 2, 7, 21, 60];
/** Mốc ngày tuổi của 5 giai đoạn lúc chạy bước age_weeks_v1 (trước khi có giai đoạn Thanh niên). */
const STAGE_MIN_DAYS_V1 = [0, 14, 56, 147, 420];

/** Bước trả về SKIP thì chưa đánh dấu đã chạy (lần khởi động sau thử lại). */
const SKIP = Symbol('skip');

const steps = {
  ledger_v1(now) {
    for (const user of allUsers()) {
      if (user.coins > 0 && !hasLedger.get(user.id)) insertOpening.run(user.id, user.coins, user.coins, now);
    }
  },
  age_weeks_v1(now) {
    for (const pet of allPets()) {
      const oldDays = Math.floor((now - pet.born_at) / HOUR);
      const stage = OLD_STAGE_DAYS.findLastIndex((d) => oldDays >= d);
      setBornAt(pet.id, now - Math.round(STAGE_MIN_DAYS_V1[stage] * PET_DAY_MS));
    }
  },
  /** Quỹ khởi tạo cho ngân sách thị trấn, để có tiền trả trợ cấp tân thủ ngay từ đầu. */
  treasury_seed_v1(now) {
    post({ account: 'treasury', delta: TREASURY_SEED, kind: 'town_seed', memo: 'Quỹ khởi tạo thị trấn', now });
  },
  skills_v1() {
    for (const pet of allPets()) {
      if (Object.keys(skillsOf(pet.id)).length) continue;
      for (const [skill, value] of Object.entries(initialSkills(Math.random))) setSkill(pet.id, skill, value);
    }
  },
  /** Bé nhận nuôi trước giai đoạn 2 chưa có tính cách: bốc ngẫu nhiên như lúc nhận nuôi. */
  traits_v1() {
    for (const pet of allPets()) {
      if (pet.traits.length) continue;
      const traits = rollTraits(Math.random);
      setTraits(pet.id, traits);
      if (traits.includes('charming')) setSkill(pet.id, 'charm', (skillsOf(pet.id).charm ?? 0) + 5);
    }
  },
  /** Phụ kiện cũ (một món mỗi bé) chuyển sang khe đồ đeo. */
  wear_v1() {
    for (const pet of allPets()) {
      const item = pet.accessory && ITEMS[pet.accessory];
      if (item?.slot) setWear(pet.id, item.slot, item.id);
    }
  },  /**
   * Trang phục có cấp: mỗi phụ kiện người chơi đang có thành một bản cấp Xanh lam với 1 dòng chỉ số ngẫu nhiên;
   * bé đang đeo món nào thì đeo đúng bản đó; tin Chợ Phiên đang bán phụ kiện chuyển thành tin bán bản đó.
   */
  gear_v1(now) {
    const accessory = (id) => ITEMS[id]?.type === 'accessory';
    const owned = db.prepare('SELECT user_id, item_id, qty FROM inventory WHERE qty > 0').all().filter((r) => accessory(r.item_id));
    const spare = new Map(); // `${userId}|${itemId}` → [gearId…] chưa đeo
    for (const r of owned) {
      const ids = [];
      for (let i = 0; i < r.qty; i++) ids.push(createGear(r.user_id, r.item_id, { tier: 'blue', source: 'legacy' }, now).id);
      spare.set(`${r.user_id}|${r.item_id}`, ids);
    }
    const dropInv = db.prepare('DELETE FROM inventory WHERE user_id = ? AND item_id = ?');
    for (const r of owned) dropInv.run(r.user_id, r.item_id);
    const worn = db.prepare('SELECT w.pet_id, w.slot, w.item_id, p.owner_id FROM pet_wear w JOIN pets p ON p.id = w.pet_id WHERE w.gear_id IS NULL').all();
    for (const w of worn) {
      if (!accessory(w.item_id)) continue;
      const key = `${w.owner_id}|${w.item_id}`;
      const gearId = spare.get(key)?.shift() ?? createGear(w.owner_id, w.item_id, { tier: 'blue', source: 'legacy' }, now).id;
      setWear(w.pet_id, w.slot, w.item_id, gearId);
    }
    const listings = db.prepare("SELECT id, seller_id, ref FROM listings WHERE status = 'open' AND kind = 'item'").all().filter((l) => accessory(l.ref));
    const relist = db.prepare("UPDATE listings SET kind = 'gear', ref = ? WHERE id = ?");
    for (const l of listings) {
      const g = createGear(l.seller_id, l.ref, { tier: 'blue', source: 'legacy' }, now);
      setGearListed(g.id, true);
      relist.run(String(g.id), l.id);
    }
  },

  /**
   * Gộp ngành (41 → 26): lô đất chuyển sang ngành mới và giữ đúng dây chuyền đang chạy; ngành đã thâu tóm đổi id,
   * gia tộc nắm hai ngành cũ nay là một thì được hoàn tiền thâu tóm của ngành thừa và trống thêm một suất ngành.
   */
  industries_merge_v1(now) {
    // Quản trị viên vừa gỡ gộp để quay lại bản cũ: giữ nguyên, không tự gộp lại khi máy chủ khởi động lại.
    if (mergeHeld()) return SKIP;
    mergeIndustries(now);
    return undefined;
  },
  /**
   * Luật đeo đồ mới (dưới cấp 30 đeo 3 món, từ cấp 30 đeo 4, Huyền thoại thêm 1): bé đang đeo quá số món
   * thì cất bớt vào tủ đồ, giữ lại những món cấp cao nhất. Không mất món nào.
   */
  wear_limit_v1() {
    for (const pet of allPets()) {
      const worn = Object.entries(wornGear(pet.id));
      const extra = worn.length - wearLimitOf(pet);
      if (extra <= 0) continue;
      worn.sort(([, a], [, b]) => TIER_ORDER.indexOf(a.tier ?? 'blue') - TIER_ORDER.indexOf(b.tier ?? 'blue'));
      for (const [slot] of worn.slice(0, extra)) setWear(pet.id, slot, null);
    }
  },
  /**
   * Gỡ kẹt: gia tộc giải tán vì không còn ai đủ quyền làm tộc trưởng từng để lại dòng thành viên của những người còn lại,
   * khiến họ không vào, không lập, cũng không rời gia tộc được. Xóa các dòng trỏ vào gia tộc đã giải tán.
   */
  clan_members_dissolved_v1() {
    const n = Number(db.prepare('DELETE FROM clan_members WHERE clan_id IN (SELECT id FROM clans WHERE dissolved_at IS NOT NULL)').run().changes);
    if (n) adminLog('Hệ thống', 'clan_members_repair', null, { freed: n });
  },
  /**
   * Tạm đóng công nghiệp nặng (xem heavy-industry.js): hoàn phí thâu tóm, gỡ ngành, lô về chưa chọn ngành.
   * Quản trị viên đã mở lại trước khi bước này chạy thì bỏ qua.
   */
  heavy_industry_close_v1(now) {
    if (heavyOpen()) return SKIP;
    const res = closeHeavyIndustries(now);
    adminLog('Hệ thống', 'heavy_industry_close', null, res);
    return undefined;
  },
};

export function migrate(now = Date.now()) {
  for (const [key, run] of Object.entries(steps)) {
    if (getMeta(`migrated_${key}`)) continue;
    transaction(() => {
      if (run(now) !== SKIP) setMeta(`migrated_${key}`, now);
    });
  }
}
