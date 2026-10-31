// Bộ icon nhóm "fun": đồ đeo, đồ chơi, trò chơi, lễ hội, giải thưởng.
// Định dạng và quy tắc vẽ: xem index.js và set-samples.js. Bóng, len, diều theo đúng hình trong itemart.js.
// 🥇 🥈 🥉 dùng chung một dáng huy chương, chỉ khác màu kim loại.

export default {
  '👑': ['wear-crown', 'Vương miện', [
    'r.....b.....r', 'y....yyy....y', 'yy..ywyyy..yY', 'ywy.yyyyy.yyY', 'ywyyyyyyyyyyY', 'yyyyyyyyyyyyY',
    'yyRyyyByyyRyY', 'yyyyyyyyyyyyY', 'YYYYYYYYYYYYY',
  ], { y: '#f4c24f', Y: '#d79c1c', w: '#fff3c4', r: '#e84a5f', b: '#7cb6e8', R: '#e84a5f', B: '#4f8fd6' }],
  '👒': ['wear-straw-hat', 'Mũ rơm', [
    '....yyyyyy....', '...ywwyyyyy...', '...ywyyyyyY...', '...yyyyyyyY...', '...rrrrrrRRpp.',
    'yyyyyyyyyyyppp', 'ywyyyyyyyyyYpY', '.YYYYYYYYYYYY.',
  ], { y: '#f2d58a', Y: '#c99a4b', w: '#fff1c2', r: '#e86f6f', R: '#c25555', p: '#f4a3b4' }],
  '👓': ['wear-glasses', 'Kính tròn', [
    '.ffff....ffff.', 'fwwbbf..fwwbbf', 'fwbbbffffwbbbf', 'fbbbbf..fbbbbf', 'fbbbBf..fbbbBf',
    '.ffff....ffff.',
  ], { f: '#5a4a66', b: '#bfe3f2', B: '#7cb6e8', w: '#ffffff' }],
  '👔': ['wear-necktie', 'Cà vạt', [
    'cc..bbbb..cc', 'cccbwbbBbcCC', '.cccbbbBcCC.', '..cccbBcCC..', '....cbBC....', '.....bB.....',
    '....bbbB....', '....sbbB....', '...bbsbbB...', '...bbbsbB...', '...sbbbsB...', '....sbbB....',
    '.....bB.....',
  ], { c: '#fff3e3', C: '#dcc0a0', b: '#4f8fd6', B: '#2f5f9e', w: '#bfe3f7', s: '#bfe3f7' }],
  '👕': ['wear-tshirt', 'Áo thun', [
    '...mmm..mmm...', '.mmwmmmmmmmmm.', 'mmwmmmmmmmmmmM', 'mwmmmmmmmmmmMM', '.MMmmmmmmmmMM.',
    '...mmpmpmmmM..', '...mmpppmmmM..', '...mmmpmmmmM..', '...mmmmmmmmM..', '...MMMMMMMMM..',
  ], { m: '#8fd3bf', M: '#4fae93', w: '#c8f0e2', p: '#f4a3b4' }],
  '👗': ['wear-dress', 'Váy', [
    '...p....P...', '...pp..PP...', '...pwpppP...', '...ppppPP...', '...yyyyyY...', '..pwpppppP..',
    '..pwppppPP..', '.pwppppppPP.', '.pppppppppP.', 'pppppppppPPP', 'ppppppppPPPP', 'lplplplplplP',
  ], { p: '#f4a3b4', P: '#d9708a', w: '#ffe1ea', y: '#f4c24f', Y: '#d79c1c', l: '#fff3e3' }],
  '🎩': ['wear-top-hat', 'Mũ chóp', [
    '..hhhhhhhh..', '..hwhhhhhH..', '..hwhhhhhH..', '..hhhhhhhH..', '..hhhhhhhH..', '..rrrrrrrR..',
    '..hhhhhhhH..', 'hhhhhhhhhhhH', '.HHHHHHHHHH.',
  ], { h: '#544c63', H: '#3a3346', w: '#8a7fa0', r: '#e86f6f', R: '#c25555' }],
  '🧢': ['wear-cap', 'Mũ lưỡi trai', [
    '......B.......', '...bbbbbb.....', '.bbwwbbbbbb...', '.bwbbbbbbbbB..', 'bwbbbbbbbbbbB.',
    'bbbbbbbbbbbbB.', 'bbbbbbbbbbbbB.', 'BBBBBBBBdddddd',
  ], { b: '#4f8fd6', B: '#2f5f9e', w: '#bfe3f7', d: '#2f5f9e' }],
  '🧣': ['wear-scarf', 'Khăn quàng', [
    '..rrrrrrrrrr..', '.rwrrrrrrrrrR.', 'rwrR......rrRR', 'rwr........rRR', 'rrrr......rrRR',
    '.rrrrrrrrrrRR.', '...rrR.rrR....', '...ssS.ssS....', '...rrR.rrR....', '...ssS.r.R....',
    '...rrR........', '...r.R........',
  ], { r: '#e2493b', R: '#b8352a', w: '#ff8a6e', s: '#fff3e3', S: '#dcc0a0' }],
  '🕶': ['wear-sunglasses', 'Kính râm', [
    'ffffffffffffff', '.gwggg..gwggg.', '.gwggg..gwggg.', '.ggggG..ggggG.', '..ggG....ggG..',
  ], { f: '#4b4458', g: '#3d3a52', G: '#2a2738', w: '#8f8aa8' }],
  '🥽': ['wear-goggles', 'Kính bảo hộ', [
    '..cccc..cccc..', '.cwgggccwgggC.', 'scwgggccwgggCs', 'scgggGccgggGCs', '.cgGGGccgGGGC.',
    '..CCCC..CCCC..',
  ], { c: '#d08a45', C: '#9b6238', g: '#9fd8c0', G: '#4fae93', w: '#ffffff', s: '#6b4a1f' }],
  '📿': ['wear-pearls', 'Chuỗi ngọc trai', [
    'wp..........wp', 'pP..........pP', '..............', '.wp........wp.', '.pP........pP.',
    '..............', '..wp......wp..', '..pP......pP..', '..............', '....wp..wp....',
    '....pPhhpP....', '.....hwhH.....', '......hH......',
  ], { w: '#ffffff', p: '#ece6f5', P: '#b9aed0', h: '#f4a3b4', H: '#d9708a' }],
  '🎀': ['wear-ribbon-bow', 'Nơ hồng', [
    '.ppp......ppp.', 'pwwpp....ppppP', 'pwpppp..pppppP', 'pppppDDDDppppP', 'pppppDkkDppPPP',
    'ppppPDDDDPPPPP', '.pPPP.DD..PPP.', '.....pDDP.....', '....ppP.pP....', '...ppP...pP...',
  ], { p: '#f4a3b4', P: '#d9708a', w: '#ffe1ea', D: '#e0607f', k: '#c44569' }],
  '🎗': ['wear-bowtie', 'Nơ cổ', [
    'bb........BB', 'bwbb....bbBB', 'bwbbbkkbbbBB', 'bbbbbkkbbbBB', 'bbbbbkkbbbBB', 'bbbb....bbBB',
    'BB........BB',
  ], { b: '#c8915f', B: '#9b6238', w: '#e8c49a', k: '#7a4a26' }],
  '🪭': ['wear-phoenix-fan', 'Quạt lông phượng', [
    '..yyyyyyyyyy..', '.yrrOOrrOOrRy.', 'yrrOOrrOOrrRRy', '.rrOOrrOOrRRR.', '..rOOrrOOrRR..',
    '...OOrrOORR...', '....OrrORR....', '.....rrRR.....', '......yY......', '......kK......',
    '......kK......',
  ], { r: '#e84a5f', R: '#c25555', O: '#ffb347', y: '#ffd75e', Y: '#d79c1c', k: '#c8915f', K: '#9b6238' }],
  '🎈': ['toy-balloon', 'Bóng bay', [
    '...bbbb...', '..bwwbbb..', '.bwwbbbbB.', '.bwbbbbbB.', '.bbbbbbbB.', '.bbbbbbBB.', '..bbbbBB..',
    '...bbBB...', '....BB....', '....BB....', '.....s....', '....s.....', '.....s....',
  ], { b: '#5aa0e6', B: '#3d78c2', w: '#d6ecfb', s: '#8a96a3' }],
  '🎉': ['party-popper', 'Chúc mừng', [
    '.........b....', '...p.......yy.', '..........y...', '.....b.p......', '..y.......bb..',
    '..yy...r......', '..yyp....p..y.', '.ppyyp........', '.yppyyp.yy....', '.yyppyyp......',
    'pyyyppyyp..b..', 'ppyyyppY......', 'yppyyY........', 'yYY...........',
  ], { y: '#ffd75e', Y: '#d79c1c', p: '#ef7fa0', b: '#7cb6e8', r: '#6dbb5a' }],
  '🎪': ['event-festival-tent', 'Lễ hội', [
    '......ggg....', '......k......', '.....rrw.....', '....rrwwr....', '...rrwwrrw...', '..rrwwrrwwR..',
    '.rrwwrrwwrRR.', 'yyyyyyyyyyyyY', '.wwrrwkwrrwW.', '.wwrrkkkrrwW.', '.wwrrkkkrrwW.', '.WWRRkkkRRWW.',
  ], { r: '#e86f6f', R: '#c25555', w: '#fff3e3', W: '#dcc0a0', y: '#f4c24f', Y: '#d79c1c', k: '#5a3a28', g: '#6dbb5a' }],
  '🎭': ['wear-party-mask', 'Mặt nạ hóa trang', [
    '.pp...........', 'pwpp.........m', '.ppm........mm', 'mmmmm......mmM', 'mwmmmmmmmmmmMM',
    'mwmmmmmyymmmMM', 'mm..mmmyymm..M', 'mm..mmmmmmm..M', '.mmmmm...mmmM.', '..mmm.....mM..',
  ], { m: '#a55fd0', M: '#7a3fa8', w: '#d6b0ef', y: '#ffd75e', p: '#f4a3b4' }],
  '🎨': ['wear-beret', 'Mũ nồi', [
    '.......R......', '....rrrrrr....', '..rwwrrrrrrr..', '.rwrrrrrrrrrR.', 'rwrrrrrrrrrrRR',
    'rrrrrrrrrrrRRR', '.RRRRRRRRRRRR.', '...ccccccccC..',
  ], { r: '#e2493b', R: '#b8352a', w: '#ff8a6e', c: '#5a3a28', C: '#3e2618' }],
  '🎤': ['job-microphone', 'Micro', [
    '..gggggg..', '.gwgGgGgG.', '.gwgggggG.', '.ggGgGgGG.', '.gggggggG.', '..GGGGGG..', '..pppppP..',
    '...hhhH...', '...hwhH...', '...hhhH...', '....hH....', '....hH....', '....HH....',
  ], { g: '#d4dae2', G: '#8a96a3', w: '#ffffff', p: '#f4a3b4', P: '#d9708a', h: '#e84a5f', H: '#c25555' }],
  '🥁': ['wear-bronze-drum', 'Trống đồng', [
    '...OOOOOOOO...', '.OOOOOOyOOOOO.', 'OOOOOOyyyOOOOO', '.OOOOOOyOOOOO.', 'oOOOOOOOOOOOoD',
    'ooooooooooooDD', 'okokokokokokDD', 'ooooooooooooDD', '.oooooooooDDD.', '.oooooooooDDD.',
    'ooooooooooooDD', 'DD..........DD',
  ], { O: '#ecd29a', o: '#c8973f', D: '#8a5f26', y: '#ffd75e', k: '#6b4a1f' }],
  '🎮': ['place-arcade-pad', 'Tay cầm trò chơi', [
    '..pppppppppp..', '.pwppppppppppP', 'pwpkpppppppbpP', 'pkkkpqpqppbpbP', 'ppkppppppppbPP',
    'pppppppppppPPP', '.pppPP..PPPPP.', '..PP......PP..',
  ], { p: '#c7b6f0', P: '#9a86d6', w: '#ece5ff', k: '#4b4458', b: '#f4a3b4', q: '#ece5ff' }],
  '🎯': ['game-target', 'Bia phi tiêu', [
    '............ff', '...rrrrr...sff', '..rrrrrrr.s...', '.rrwwwwwrs....', 'rrwwrrrwsrr...',
    'rrwrrrrswrR...', 'rrwrrrrrwRR...', 'rrwrrrrrwRR...', 'rrwwrrrwwRR...', '.rrwwwwwRR....',
    '..rrrRRRR.....', '...rRRRR......',
  ], { r: '#e86f6f', R: '#c25555', w: '#fff3e3', s: '#8a96a3', f: '#6dbb5a' }],
  '🎾': ['toy-tennis-ball', 'Bóng tennis', [
    '...gggggg...', '..wggggggw..', '.ggwggggwgg.', 'gghhwggwgggg', 'ggggwggwgggG', 'ggggwggwgggG',
    'ggggwggwgggG', 'ggggwggwggGG', 'ggggwggwggGG', '.ggwggggwGG.', '..wggggGGw..', '...gGGGGG...',
  ], { g: '#cfe35a', G: '#9bb636', w: '#ffffff', h: '#f0f7b8' }],
  '⚽': ['toy-ball', 'Bóng nảy', [
    '...rrryyy...', '..rrrryyyy..', '.rwwrryyyyy.', 'rrwrrryyyyyy', 'rrrrrryyyyyY', 'rrrrrryyyyyY',
    'bbbbbbgggggG', 'bbbbbbgggggG', 'bbbbbbggggGG', '.bbbbbgggGG.', '..bbbbggGG..', '...bBBGGG...',
  ], { r: '#e84a5f', R: '#c23a4d', y: '#ffd75e', Y: '#e0a422', b: '#4f8fd6', B: '#3a6fb0', g: '#6dbb5a', G: '#4e9a45', w: '#ffffff' }],
  '🪁': ['toy-kite', 'Diều giấy', [
    '.....r.....', '....rry....', '...rwryy...', '..rwrryyy..', '.rrrrryyyY.', 'rrrrrryyyYY', '.bbbbbgggG.',
    '..bbbbggG..', '...bbbgG...', '....bbG....', '.....s.....', '......s....', '.....s.....',
  ], { r: '#e84a5f', y: '#ffd75e', Y: '#e0a422', b: '#4f8fd6', g: '#6dbb5a', G: '#4e9a45', s: '#8a5a35', w: '#ff9aa8' }],
  '🧶': ['toy-yarn', 'Cuộn len', [
    '...ppppp...', '.pwPPpppp..', 'pwppPPpppp.', 'pPpppPPppP.', 'ppPpppPPpP.', 'pppPpppPPP.', '.pppPpppPP.',
    '..pppppPP..', '........pp.', '.........pp',
  ], { p: '#c79bf2', P: '#9a6bd0', w: '#e6d2fb' }],
  '🧩': ['game-puzzle-piece', 'Ghép hình', [
    '....ggg.......', '...gwggG......', '....ggG.......', 'ggggggggggG...', 'gwggggggggG...',
    'gwggggggggG...', '...ggggggggggG', '...ggggggggggG', '...gggggggggGG', 'ggggggggggG...',
    'ggggggggggG...', 'GGGGGGGGGGG...',
  ], { g: '#8fd3bf', G: '#4fae93', w: '#c8f0e2' }],
  '🃏': ['game-card', 'Lá bài', [
    '.wwwwwwwww.', 'wrwwwwwwwwW', 'wwwwwwwwwwW', 'wwwrrwrrwwW', 'wwrprrrrrwW', 'wwrrrrrrrwW', 'wwwrrrrrwwW',
    'wwwwrrrwwwW', 'wwwwwrwwwwW', 'wwwwwwwwwwW', 'wwwwwwwwwrW', '.WWWWWWWWW.',
  ], { w: '#fffaf3', W: '#dcc0a0', r: '#e84a5f', p: '#ff9aa8' }],
  '🎣': ['game-fishing-rod', 'Câu cá', [
    '...........tt.', '..........tt.s', '.........tt..s', '........tt...s', '.......tt....s',
    '......tt.....s', '.....tt.....rr', '....tt......ww', '...hh.........', '..hhgg........',
    '.hh.gG........', 'hh............',
  ], { t: '#c8915f', h: '#9b6238', g: '#b9c2cc', G: '#8a96a3', s: '#8a96a3', r: '#e84a5f', w: '#fff3e3' }],
  '🏅': ['award-sports-medal', 'Huy chương', [
    'rr........bb', 'rRr......bBb', '.rRr....bBb.', '..rRr..bBb..', '...rRrbBb...', '....yyyy....',
    '...ywyyyY...', '..ywyyyyyY..', '..yyyyyyyY..', '..yyyyyyYY..', '...yyyyYY...', '....YYYY....',
  ], { y: '#f4c24f', Y: '#d79c1c', w: '#fff3c4', r: '#e86f6f', R: '#c25555', b: '#7cb6e8', B: '#4f8fd6' }],
  '🏆': ['award-trophy', 'Cúp vàng', [
    'yyyyyyyyyyyy', 'yywwyyyyyyYY', 'yywyyyyyyyYY', '.ywyyyyyyyY.', '.yyyyyyyyyY.', '..yyyyyyYY..',
    '...yyyyYY...', '....yyYY....', '.....yY.....', '.....yY.....', '....yyYY....', '..ttttttTT..',
    '..TTTTTTTT..',
  ], { y: '#f4c24f', Y: '#d79c1c', w: '#fff3c4', t: '#c8915f', T: '#9b6238' }],
  '🥇': ['award-medal-gold', 'Hạng nhất', [
    '.rrR....rrR.', '.rrR....rrR.', '..rrR..rrR..', '..rrR..rrR..', '...rrRrrR...', '....mmmm....',
    '..mmhmmmMM..', '.mmhmmsmmmM.', '.mhmmsssmmM.', '.mmssssssmM.', '.mmmsssmmMM.', '.mmmsmsmmMM.',
    '..mmmmmmMM..', '....MMMM....',
  ], { r: '#7cb6e8', R: '#4f8fd6', m: '#f4c24f', M: '#d79c1c', h: '#fff3c4', s: '#ffd75e' }],
  '🥈': ['award-medal-silver', 'Hạng nhì', [
    '.rrR....rrR.', '.rrR....rrR.', '..rrR..rrR..', '..rrR..rrR..', '...rrRrrR...', '....mmmm....',
    '..mmhmmmMM..', '.mmhmmsmmmM.', '.mhmmsssmmM.', '.mmssssssmM.', '.mmmsssmmMM.', '.mmmsmsmmMM.',
    '..mmmmmmMM..', '....MMMM....',
  ], { r: '#7cb6e8', R: '#4f8fd6', m: '#c9d1da', M: '#8a96a3', h: '#ffffff', s: '#e6ebf0' }],
  '🥉': ['award-medal-bronze', 'Hạng ba', [
    '.rrR....rrR.', '.rrR....rrR.', '..rrR..rrR..', '..rrR..rrR..', '...rrRrrR...', '....mmmm....',
    '..mmhmmmMM..', '.mmhmmsmmmM.', '.mhmmsssmmM.', '.mmssssssmM.', '.mmmsssmmMM.', '.mmmsmsmmMM.',
    '..mmmmmmMM..', '....MMMM....',
  ], { r: '#7cb6e8', R: '#4f8fd6', m: '#d08a4a', M: '#9b5a2a', h: '#f2c49b', s: '#e6a56a' }],
  '🎖': ['award-honor-medal', 'Huân chương', [
    '.bbrrwwrrbb.', '.bbrrwwrrBB.', '.bbrrwwrrBB.', '.BBRRwwRRBB.', '.....yy.....', '.....yY.....',
    '....yyyY....', 'yyyyywyyyyyY', '.yyywyyyyYY.', '..yyyyyyYY..', '..yyyY.yYY..', '.yyY....YYY.',
  ], { y: '#f4c24f', Y: '#d79c1c', w: '#fff3c4', b: '#4f8fd6', B: '#2f5f9e', r: '#e86f6f', R: '#c25555' }],
  '🎓': ['award-graduation-cap', 'Mũ tốt nghiệp', [
    '......hh......', '....hhhhhh....', '..hwhhhhhhhh..', 'hwwhhhhhhhhhhH', '..hhhhhhhhhHy.',
    '....hhhhHH..y.', '...dddddddD.y.', '...dddddddD.y.', '...ddddddDD.yy', '....DDDDDD..yy',
  ], { h: '#544c63', H: '#3a3346', w: '#8a7fa0', d: '#3a3346', D: '#2a2533', y: '#ffd75e' }],
};
