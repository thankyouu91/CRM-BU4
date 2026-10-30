// Chuyển dữ liệu cũ sang mô hình mới. Mỗi bước chạy đúng một lần (đánh dấu trong bảng meta).
import { allPets, allUsers, db, getMeta, setBornAt, setMeta, setSkill, setTraits, setWear, skillsOf, transaction } from './db.js';
import { HOUR, ITEMS, PET_DAY_MS } from './game.js';
import { post } from './ledger.js';
import { initialSkills } from './rules/careers.js';
import { createGear, setGearListed, wearLimitOf, wornGear } from './gear.js';
import { TIER_ORDER } from '../../public/ta-tua/game/js/shared/gear.js';
import { MERGED_INTO } from '../../public/ta-tua/game/js/shared/industry.js';
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
    // Lô làm "Điện tử, máy tính" cũ (giữ id electronics) chạy dây chuyền máy tính.
    db.prepare("UPDATE land_plots SET variant = 'electronics' WHERE industry = 'electronics' AND variant IS NULL").run();
    const setPlot = db.prepare('UPDATE land_plots SET industry = ?, variant = ? WHERE id = ?');
    for (const row of db.prepare('SELECT id, industry FROM land_plots WHERE industry IS NOT NULL').all()) {
      const to = MERGED_INTO[row.industry];
      if (to) setPlot.run(to.industry, to.line, row.id);
    }
    const rows = db.prepare('SELECT * FROM clan_industries ORDER BY clan_id, entered_at').all();
    const drop = db.prepare('DELETE FROM clan_industries WHERE clan_id = ? AND industry = ?');
    const rename = db.prepare('UPDATE clan_industries SET industry = ? WHERE clan_id = ? AND industry = ?');
    const news = db.prepare('INSERT INTO news (commodity, headline, effect, created_at, starts_at, ends_at) VALUES (NULL, ?, 0, ?, ?, ?)');
    const kept = new Map(); // clan → các ngành mới đã có
    for (const r of rows) {
      const target = MERGED_INTO[r.industry]?.industry ?? r.industry;
      const have = kept.get(r.clan_id) ?? new Set();
      if (have.has(target)) {
        drop.run(r.clan_id, r.industry);
        if (r.fee > 0) post({ account: `clan:${r.clan_id}`, delta: r.fee, kind: 'clan_comp', memo: `Hoàn tiền thâu tóm ${r.industry} (gộp ngành)`, now });
      } else {
        if (target !== r.industry) rename.run(target, r.clan_id, r.industry);
        have.add(target);
      }
      kept.set(r.clan_id, have);
    }
    news.run('🏭 Sở Kế hoạch gộp các ngành na ná nhau: 41 ngành còn 26. Đất và nhà máy giữ nguyên dây chuyền; gia tộc nắm ngành trùng được hoàn tiền thâu tóm.', now, now, now + 3 * 86_400_000);
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
};

export function migrate(now = Date.now()) {
  for (const [key, run] of Object.entries(steps)) {
    if (getMeta(`migrated_${key}`)) continue;
    transaction(() => {
      run(now);
      setMeta(`migrated_${key}`, now);
    });
  }
}
