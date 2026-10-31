// Bộ mẫu chốt phong cách: lưới tối đa 14×14, viền nâu tự thêm, tô sáng góc trên trái, tối cạnh phải và đáy.
const GOLD = { y: '#f4c24f', Y: '#d79c1c', w: '#fff3c4' };

export default {
  '🪙': ['coin', 'Xu', [
    '...yyyyyy...', '..ywwyyyyy..', '.ywyyyyyyyY.', '.yyyYYYYyyY.', 'yyyYyyyyYyyY', 'yyyYyyyyYyyY',
    'yyyYyyyyYyyY', 'yyyYyyyyYyyY', '.yyyYYYYyyY.', '.yyyyyyyyYY.', '..yyyyyyYY..', '...YYYYYY...',
  ], GOLD],
  '💖': ['heart-sparkle', 'Trái tim', [
    '.ppp...ppp.', 'pwwpp.ppppp', 'pwppppppppP', 'ppppppppppP', 'ppppppppppP', '.pppppppPP.',
    '..pppppPP..', '...pppPP...', '....pPP....', '.....P.....',
  ], { p: '#ef7fa0', P: '#d9708a', w: '#ffe1ea' }],
  '⚡': ['bolt', 'Năng lượng', [
    '....yyyy', '...ywyy.', '..ywyy..', '.yyyy...', 'yyyyyyy.', '...yyyY.', '..yyyY..', '..yyY...', '.yyY....', '.yY.....', '.Y......',
  ], { y: '#ffd75e', Y: '#e0a422', w: '#fff6c9' }],
  '🔒': ['lock', 'Đang khóa', [
    '...gggg...', '..gG..Gg..', '..g....g..', '..g....g..', 'yyyyyyyyyy', 'ywyyyyyyyY',
    'yyyykkyyyY', 'yyyykkyyyY', 'yyyyykyyyY', 'yyyyyyyyyY', 'YYYYYYYYYY',
  ], { ...GOLD, g: '#b9c2cc', G: '#8a96a3', k: '#2e1d14' }],
  '⭐': ['star', 'Ngôi sao', [
    '......y......', '.....yyy.....', '.....ywy.....', '....yyyyy....', 'yyyyyyyyyyyyy', '.yyyyyyyyyyy.',
    '..yyyyyyyyY..', '...yyyyyyY...', '...yyyyyyY...', '..yyyY.yyYY..', '..yyY...yYY..', '.yY.......YY.',
  ], { y: '#ffd75e', Y: '#e0a422', w: '#fff6c9' }],
  '🎁': ['gift', 'Quà', [
    '...yy..yy...', '..y..yy..y..', '...yyyyyy...', 'pppppyyppppp', 'pwppPyyPpppP', 'PPPPPyyPPPPP',
    '.ppppyypppp.', '.ppppyypppp.', '.ppppyypppp.', '.ppppyypppp.', '.PPPPyyPPPP.',
  ], { p: '#f4a3b4', P: '#d9708a', w: '#ffe1ea', y: '#f4c24f' }],
  '🏠': ['home', 'Nhà', [
    '......rr......', '.....rrrr.....', '....rrrrrr....', '...rrrrrrrr...', '..rrrrrrrrrr..', '.rrrrrrrrrrrr.',
    'RRRRRRRRRRRRRR', '.wwwwwwwwwwww.', '.wbbbwwwwddww.', '.wbbbwwwwddww.', '.wwwwwwwwddww.', '.wwwwwwwwddww.', '.WWWWWWWWWWWW.',
  ], { r: '#e86f6f', R: '#c25555', w: '#fff3e3', W: '#dcc0a0', b: '#bfe3f2', d: '#c8915f' }],
  '🌳': ['tree', 'Cây', [
    '....gggg....', '..gggggggg..', '.gglggggggg.', 'gglgggggggGg', 'gggggggggggG', 'gggggggggGGG',
    '.ggggggggGG.', '..GGGGGGGG..', '.....tt.....', '.....tt.....', '....tttt....',
  ], { g: '#6dbb5a', G: '#4e9a45', l: '#a8e08f', t: '#9b6238' }],
  '🎒': ['backpack', 'Túi đồ', [
    '...ssss...', '..s....s..', '.bbbbbbbb.', 'bwbbbbbbbB', 'bbbbbbbbbB', 'bpppppppbB',
    'bpbbbbbpbB', 'bpppppppbB', 'bbbbbbbbbB', '.BBBBBBBB.',
  ], { b: '#e86f6f', B: '#c25555', p: '#f4a3b4', s: '#9b6238', w: '#ffb3b3' }],
  '👛': ['purse', 'Ví', [
    '...y..y...', '..yy..yy..', '.pppppppp.', 'pppppppppP', 'pwpppppppP', 'pppppppppP', 'pppppppppP', '.PPPPPPPP.',
  ], { p: '#f4a3b4', P: '#d9708a', w: '#ffe1ea', y: '#f4c24f' }],
  '👥': ['friends', 'Bạn bè', [
    '.......MMM..', '......MMMMM.', '..PPP.MMMMM.', '.PPPPP.MMM..', '.PPPPP......', '..PPP.mmmmm.',
    '.....mmmmmmm', '.ppppppmmmmm', 'pppppppppmmm', 'pppppppppmmm',
  ], { P: '#ffd9b3', M: '#f2c49b', p: '#f4a3b4', m: '#8fd3bf' }],
  '🗺': ['map', 'Bản đồ', [
    'ttttTTTTtttt', 'tggtTTbTttrt', 'tgggTbbTtrrr', 'ttggTbTTttrt', 'tttgbbTTtttt', 'ttttbTTTgttt',
    'tbbbbTTTggtt', 'tbtttTTTtggt', 'ttttTTTTtttt',
  ], { t: '#f6e7c8', T: '#e2c9a0', g: '#6dbb5a', b: '#7cb6e8', r: '#e84a5f' }],
  '🧋': ['boba', 'Trà sữa', [
    '......ss..', '.....ss...', '.....s....', 'LLLLLsLLLL', '.tttttttt.', '.twtttttt.', '.twtttttt.',
    '.tttttttt.', '.tpptpptt.', '..pptppt..', '..pppppp..', '...pppp...',
  ], { s: '#ff8fb1', L: '#e9eef5', t: '#e8c49a', w: '#fff3e0', p: '#3d2a1f' }],
};
