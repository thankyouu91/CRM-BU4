// Tự sinh bởi scripts/art/build-items.py, đừng sửa tay: có icon mới được duyệt thì chạy lại script.
// Bảng khung icon đồ 32x32 trong atlas WebP (assets/items/). itemart.js đọc thẳng module này nên dựng icon
// ngay khi vẽ màn, không phải tải JSON và không nháy. frames: id catalog -> [trang, x, y] (điểm ảnh gốc).
// ?v= là mã băm nội dung trang, đổi ảnh thì trình duyệt tải lại.
export const ITEM_ATLAS = {
  size: 32,
  pages: [
    { url: new URL('../assets/items/items-0.webp?v=638d23b2a8', import.meta.url).href, w: 529, h: 100 },
  ],
  frames: {
    ball: [0, 1, 1], bath: [0, 34, 1], boba: [0, 67, 1], cake: [0, 100, 1], cane: [0, 133, 1], cassava: [0, 166, 1],
    clan_care: [0, 199, 1], clan_care_ngon: [0, 232, 1], clan_care_tuyet: [0, 265, 1], clan_meal: [0, 298, 1],
    clan_meal_ngon: [0, 331, 1], clan_meal_tuyet: [0, 364, 1], condensed: [0, 397, 1], dried_tea: [0, 430, 1],
    egg_hoa: [0, 463, 1], egg_kim: [0, 496, 1], egg_moc: [0, 1, 34], egg_tho: [0, 34, 34], egg_thuy: [0, 67, 34],
    fish: [0, 100, 34], grilled_fish: [0, 133, 34], home_milk_tea: [0, 166, 34], juice: [0, 199, 34],
    kite: [0, 232, 34], mango: [0, 265, 34], milk: [0, 298, 34], onigiri: [0, 331, 34], pearl: [0, 364, 34],
    pork: [0, 397, 34], strawberry: [0, 430, 34], strawberry_cake: [0, 463, 34], strawberry_smoothie: [0, 496, 34],
    sugar: [0, 1, 67], sushi: [0, 34, 67], tea_boba_milk_tea: [0, 67, 67], tea_brown_sugar_milk: [0, 100, 67],
    tea_condensed_tea: [0, 133, 67], tea_leaf: [0, 166, 67], tea_milk_tea: [0, 199, 67],
    tea_strawberry_smoothie: [0, 232, 67], tea_strawberry_tea: [0, 265, 67], vitamin: [0, 298, 67],
    yarn: [0, 331, 67],
  },
};
