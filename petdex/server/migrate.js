// Chuyển dữ liệu cũ sang mô hình mới. Mỗi bước chạy đúng một lần (đánh dấu trong bảng meta).
import { allPets, allUsers, db, getMeta, setBornAt, setMeta, setSkill, setTraits, setWear, skillsOf, transaction } from './db.js';
import { HOUR, ITEMS, PET_DAY_MS } from './game.js';
import { post } from './ledger.js';
import { initialSkills } from './rules/careers.js';
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
