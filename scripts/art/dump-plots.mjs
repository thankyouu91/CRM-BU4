// In ra (stdout, JSON) hình học bản đồ đất đúng như game dùng: PLOTS, tâm và đỉnh lục giác, đường sông, plots_hash.
// scripts/art/build-landmap.py gọi script này, nên tranh luôn dựng từ chính clan.js + landmap.js, không chép thuật toán.
//   node scripts/art/dump-plots.mjs
import { mapGeometry } from '../../public/ta-tua/game/js/landmap.js';

process.stdout.write(JSON.stringify(mapGeometry()));
