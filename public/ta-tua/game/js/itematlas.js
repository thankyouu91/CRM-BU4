// Tự sinh bởi scripts/art/build-items.py, đừng sửa tay: có icon mới được duyệt thì chạy lại script.
// Bảng khung icon đồ 32x32 trong atlas WebP (assets/items/). itemart.js đọc thẳng module này nên dựng icon
// ngay khi vẽ màn, không phải tải JSON và không nháy. frames: id catalog -> [trang, x, y] (điểm ảnh gốc).
// ?v= là mã băm nội dung trang, đổi ảnh thì trình duyệt tải lại.
export const ITEM_ATLAS = {
  size: 32,
  pages: [
    { url: new URL('../assets/items/items-0.webp?v=2acdf67c65', import.meta.url).href, w: 529, h: 199 },
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
    yarn: [0, 331, 67], bauxite: [0, 364, 67], coal: [0, 397, 67], copper: [0, 430, 67], crude_oil: [0, 463, 67],
    diamond: [0, 496, 67], gas: [0, 1, 100], gold: [0, 34, 100], iron_ore: [0, 67, 100], rare_earth: [0, 100, 100],
    salt: [0, 133, 100], silicon: [0, 166, 100], silver: [0, 199, 100], tin: [0, 232, 100], titanium: [0, 265, 100],
    uranium: [0, 298, 100], beans: [0, 331, 100], beef: [0, 364, 100], chicken: [0, 397, 100], cotton: [0, 430, 100],
    maize: [0, 463, 100], potatoes: [0, 496, 100], power: [0, 1, 133], rice: [0, 34, 133], rubber: [0, 67, 133],
    timber: [0, 100, 133], wheat: [0, 133, 133], aircraft: [0, 166, 133], aluminium: [0, 199, 133],
    autos: [0, 232, 133], chemicals: [0, 265, 133], chips: [0, 298, 133], clothing: [0, 331, 133],
    computers: [0, 364, 133], fuel: [0, 397, 133], furniture: [0, 430, 133], machinery: [0, 463, 133],
    medicine: [0, 496, 133], processed_food: [0, 1, 166], ships: [0, 34, 166], steel: [0, 67, 166],
    trains: [0, 100, 166],
  },
};
