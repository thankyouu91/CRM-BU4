// Công thức đồ uống của quầy trà sữa và đồ uống bán tại quầy cho bé. Tách riêng, không import gì,
// để game.js (danh mục vật phẩm) và rules/business.js cùng dùng mà không vòng import.

/** Mỗi ly dùng bao nhiêu phần nguyên liệu (1 lô = 10 phần). */
export const RECIPES = {
  boba_milk_tea: { name: 'Trà sữa trân châu', icon: '🧋', inputs: { dried_tea: 1, milk: 1, pearl: 1, sugar: 1 } },
  milk_tea: { name: 'Trà sữa truyền thống', icon: '🥤', inputs: { dried_tea: 1, milk: 1, sugar: 1 } },
  brown_sugar_milk: { name: 'Sữa tươi trân châu đường đen', icon: '🥛', inputs: { milk: 1, pearl: 1, sugar: 1 } },
  strawberry_tea: { name: 'Trà dâu', icon: '🍓', inputs: { dried_tea: 1, strawberry: 1, sugar: 1 } },
  strawberry_smoothie: { name: 'Sinh tố dâu sữa', icon: '🍹', inputs: { strawberry: 2, milk: 1 } },
  condensed_tea: { name: 'Trà sữa sữa đặc', icon: '🍼', inputs: { dried_tea: 1, condensed: 1, pearl: 1, sugar: 1 } },
};

/**
 * Bé uống ở quầy: mỗi ly mua tại quầy của người chơi có chỉ số (no, vui) và XP gấp `statMult` lần
 * trà sữa trân châu ở Siêu thị. Mỗi người mua tối đa `dailyCups` ly mỗi ngày, `maxPerOrder` ly một lần.
 */
export const TEA_SHOP = { statMult: 2, dailyCups: 10, maxPerOrder: 5 };

export const teaItemId = (recipe) => `tea_${recipe}`;
