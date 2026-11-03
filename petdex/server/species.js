import { ELEMENTS, GUEST_SPECIES, MASCOTS, SPECIES, SPECIES_BY_ID } from '../../public/ta-tua/game/js/shared/pets.js';
import { settings } from './settings.js';

/**
 * Loài khách mời cài từ Petdex (ảnh vẽ sẵn). Máy chủ chứa game quét thư mục pets/ cạnh trang game
 * (đúng định dạng `npx petdex install`: pet.json + spritesheet) và đưa danh sách vào settings.guestPets;
 * trên Cloudflare không có hệ thống file nên danh sách rỗng.
 */
function guestSpecies() {
  return (settings.guestPets ?? [])
    // Loài đã có bản vẽ bằng bộ khung (như Boba) thì không dùng ảnh Petdex nữa.
    .filter((p) => !SPECIES_BY_ID[p.id])
    .map((p) => ({
      id: p.id,
      name: p.displayName ?? p.id,
      description: GUEST_SPECIES[p.id]?.description ?? p.description ?? '',
      sprite: `pets/${encodeURIComponent(p.id)}/${encodeURIComponent(p.spritesheet ?? 'spritesheet.webp')}`,
      guest: true,
      element: GUEST_SPECIES[p.id]?.element ?? 'thuy',
      rarity: GUEST_SPECIES[p.id]?.rarity ?? 'thuong',
      adoptable: true,
    }));
}

/**
 * Mọi loài: linh vật Boba, khách mời Petdex (nếu cài thêm), rồi 50 loài ngũ hành vẽ bằng bộ khung (public/js/rig.js).
 * Ở bước này chỉ loài Thường nhận nuôi trực tiếp được; loài hiếm hơn sẽ nở từ trứng ngũ hành.
 */
export function listSpecies() {
  return [
    ...MASCOTS.map((s) => ({
      id: s.id, name: s.name, element: s.element, rarity: s.rarity, rig: true, mascot: true, adoptable: true, description: s.description,
    })),
    ...guestSpecies(),
    ...SPECIES.map((s) => ({
      id: s.id, name: s.name, element: s.element, rarity: s.rarity, rig: true,
      adoptable: s.rarity === 'thuong', description: ELEMENTS[s.element].temper,
    })),
  ];
}

export const getSpecies = (id) => listSpecies().find((s) => s.id === id);
