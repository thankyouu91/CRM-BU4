// Bộ icon nhóm "food". Định dạng và quy tắc vẽ: xem index.js và set-samples.js.
// Đồ ăn, thức uống, bếp, chăm sóc và sức khỏe. Món nào đã có hình trong itemart.js (cơm nắm, sushi,
// bánh kem, hộp nước, bồn tắm, vitamin) thì vẽ dựa trên hình đó để Siêu thị và icon trông như một bộ.
const K = '#2e1d14';
const LEAF = { g: '#6dbb5a', G: '#4e9a45', l: '#a8e08f' };
const GLASS = { g: '#d6eef7', G: '#9fc6de', w: '#ffffff' };
const CAKE = { R: '#e84a5f', r: '#ff8fa0', w: '#ffffff', W: '#f3dfe6', p: '#ffc4d6', P: '#f2a0b8', c: '#f6d79a', C: '#dfb46a', d: '#dfe3ec' };

export default {
  '🌽': ['food-corn', 'Ngô', [
    '....yyy...', '...ywyyy..', '...wyYyY..', '...yYyYy..', '...yyYyY..', 'g..yYyYyY.',
    'gg.yyYyYGG', '.gglyYyGG.', '.gglgYGGG.', '..glggGG..', '...gggG...', '....gG....',
  ], { y: '#ffd75e', Y: '#e0a422', w: '#fff6c9', ...LEAF }],
  '🍓': ['food-strawberry', 'Dâu tây', [
    '...g..g...', '..gggggg..', '.rrglggrr.', 'rwrrrrrrrR', 'rwrsrrsrrR', 'rrrrrrrrrR',
    '.rsrrrsrR.', '.rrrrrrrR.', '..rrsrrR..', '...rrrR...', '....RR....',
  ], { r: '#e84a5f', R: '#c23a4e', w: '#ff9aa8', s: '#ffe08a', ...LEAF }],
  '🍗': ['food-drumstick', 'Đùi gà', [
    '..bbbbb.....', '.bwwbbbb....', 'bwbbbbbbb...', 'bbbbbbbbbB..', 'bbbbbbbbbB..', 'bbbbbbbbBB..',
    '.bbbbbbBBB..', '..bbbbBBBc..', '...BBBBBBcc.', '.........cc.', '........ccCc',
    '.........cCC', '..........C.',
  ], { b: '#e0a050', B: '#b97535', w: '#f6cf8a', c: '#fff3e3', C: '#dcc0a0' }],
  '🍙': ['food-rice-ball', 'Cơm nắm', [
    '.....w.....', '....www....', '...wwwww...', '..wwwwwwW..', '..wwwwwwW..', '.wwwwwwwwW.',
    '.wwwnnnwwW.', 'wwwwnnnwwwW', 'wwwwnnnwwWW', '.WWWnnnWWW.',
  ], { w: '#fbf8ef', W: '#ddd5c2', n: '#2f3b2f' }],
  '🍚': ['food-rice-bowl', 'Bát cơm', [
    '....wwww....', '..whwwwwWW..', '.whwwwwwwwW.', '.wwwwwwwwWW.', 'bbbbbbbbbbbb', 'bpbbbbbbbbbB', '.bpbbbbbbbB.',
    '.bbbbbbbbbB.', '..bbbbbbBB..', '...BBBBBB...', '....bbbB....',
  ], { w: '#fffaf3', W: '#d9ccb0', h: '#ffffff', b: '#7cb6e8', B: '#4f8fd6', p: '#bfe3f2' }],
  '🍣': ['food-sushi', 'Sushi', [
    '..oo....oo..', '.oOoo..oOoo.', '.oooo..oooo.', '.rrrR..rrrR.', '.rrrR..rrrR.', 'bbbbbbbbbbbb',
    'bBBBBBBBBBBb', '.b........b.',
  ], { o: '#ff9a6b', O: '#ffc4a3', r: '#fbf8ef', R: '#ddd5c2', b: '#b98a52', B: '#d9a85c' }],
  '🍮': ['food-pudding', 'Thạch trà', [
    '....cccc....', '...cwccCC...', '...yyyyyY...', '..yhyyyyyY..', '..yhyyyyyY..', '.yyyyyyyyyY.',
    '.yyyyyyyyYY.', 'pppppppppppp', '.PPPPPPPPPP.',
  ], { c: '#9b6238', C: '#7a4a28', w: '#c8915f', y: '#f6d79a', Y: '#e0b060', h: '#fff3c4', p: '#e9eef5', P: '#b9c2cc' }],
  '🍰': ['food-cake-slice', 'Bánh dâu', [
    '........RR..', '.......RrRR.', '.....wwwRRw.', '...wwwwwwwwW', '.wwwwwwwwwwW', 'pppppppppppP',
    'ccccccccccCC', 'pppppppppppP', 'ccccccccccCC', 'ccccccccccCC', 'dddddddddddd',
  ], CAKE],
  '🎂': ['food-birthday-cake', 'Sinh nhật', [
    '..f...f...f..', '..s...s...s..', '..s...s...s..', '.wwwwwwwwwwW.', 'wwwwwwwwwwwwW', 'pwwpwwpwwpwwP',
    'ppppppppppppP', 'ccccccccccccC', 'ppppppppppppP', 'ccccccccccccC', 'ddddddddddddd',
  ], { ...CAKE, f: '#ffa53d', s: '#7cb6e8' }],
  '🍱': ['food-bento', 'Suất ăn', [
    'thhttttttttt', 'twwwwwtgglgT', 'twwwwwtggggT', 'twwrwwtgGggT', 'twwwwwttttTT', 'twwwwwtoOyyT',
    'twwwwwtooyyT', 'tttttttttttT', 'TTTTTTTTTTTT',
  ], { t: '#e86f6f', T: '#c25555', h: '#ffa3a3', w: '#fffaf3', r: '#e84a5f', o: '#ff9a6b', O: '#ffc4a3', y: '#ffd75e', ...LEAF }],
  '🍲': ['food-stew-pot', 'Nồi canh', [
    '...s....s...', '....s....s..', '...s....s...', '..cgccocgc..', 'mmmmmmmmmmmm', 'nmwmmmmmmmMn',
    '.mwmmmmmmmM.', '.mmmmmmmmmM.', '..mmmmmmMM..', '...MMMMMM...',
  ], { s: '#e9eef5', c: '#f0a050', o: '#ff9a6b', g: '#6dbb5a', m: '#e86f6f', M: '#c25555', w: '#ffb3b3', n: '#9b6238' }],
  '🍳': ['food-fried-egg', 'Bếp', [
    '...ggggg......', '.gggwwwggg....', 'ggwwwwwwwgg...', 'gwwwyyywwwG...', 'gwwwyhyywwG...', 'gwwwyyywwwGttt',
    'ggwwwwwwwGGttt', '.gGwwwwwGG....', '..GGGGGGG.....',
  ], { g: '#8a96a3', G: '#6b7682', w: '#ffffff', y: '#ffc23d', h: '#fff1b0', t: '#9b6238' }],
  '🍵': ['food-green-tea', 'Trà', [
    '...s..s...', '..s..s....', '...s..s...', 'tttttttttt', 'cwcccccccC', 'cwcccccccC', 'cccccccccC',
    '.ccccccCC.', '..CCCCCC..',
  ], { s: '#fffaf3', t: '#a8d870', c: '#8fd3bf', C: '#4fae93', w: '#d6f3ea' }],
  '🍹': ['food-smoothie', 'Sinh tố', [
    '.s.........', '..s.....gg.', '...s...rrrr', '....s..rwrR', 'LLLLsLLrrRR', '.pwpspppRR.',
    '.pwppppppP.', '.pwppppppP.', '..pppppPP..', '...pppPP...', '....LLL....', '.....L.....',
    '...LLLLL...',
  ], { s: '#f4c24f', L: '#e9eef5', p: '#f4a3b4', P: '#d9708a', w: '#ffe1ea', r: '#e84a5f', R: '#c23a4e', g: '#6dbb5a' }],
  '🍼': ['food-milk-bottle', 'Sữa đặc', [
    '...nn...', '..nnnN..', '..nnnN..', '.cccccC.', '.cccccC.', '.gwgggG.', '.gggggG.',
    '.mmmmlM.', '.mmmmmM.', '.mmmmlM.', '.mmmmmM.', '.MMMMMM.',
  ], { n: '#f6c46a', N: '#d9a04a', c: '#f4a3b4', C: '#d9708a', g: '#e8f4fc', G: '#bcd9ea', w: '#ffffff', m: '#fffaf3', M: '#dcd6c4', l: '#7cb6e8' }],
  '🍽': ['food-plate', 'Cho ăn', [
    'f..pppppp...k.', 'f.pppppppp.kk.', 'f.ppqqqqpp.kk.', 'ffpqqqqqqpPkk.', '.fpqqqqqqpPkk.',
    '.fpqqqqqqpPk..', '.fpqqqqqqpPk..', '.f.pqqqqpP.k..', '.f.ppppPPP.k..', '.f...PPPP..k..',
  ], { p: '#fffaf3', q: '#e6e9f0', P: '#b9c2cc', f: '#b9c2cc', k: '#8a96a3' }],
  '🥔': ['food-potato', 'Củ', [
    '...tttttt...', '.ttwttttttt.', 'twwttttdtttT', 'ttttttttttTT', 'tttdtttttdTT', 'ttttttttTTT.',
    '.ttttttTTT..', '..TTTTTT....',
  ], { t: '#c8915f', T: '#9b6238', w: '#e8c49a', d: '#7a4a28' }],
  '🥚': ['food-egg', 'Trứng', [
    '...eee...', '..eeeeE..', '.eheeeeE.', '.eheesse.', 'eeeeesseE', 'esseeeeeE', 'esseeeesE',
    'eeeeeessE', '.eeeeeEE.', '..EEEEE..',
  ], { e: '#fff0dc', E: '#e6cfae', h: '#ffffff', s: '#f4a3b4' }],
  '🥛': ['food-milk', 'Sữa tươi', [
    'ggggggggg', 'geeeeeeeG', 'gwmmmmmMG', 'gwmmmmmMG', 'gmmmmmmMG', 'gmmmmmmMG', '.gmmmmMG.',
    '.gmmmmMG.', '.gmmmmMG.', '.GGGGGGG.',
  ], { g: '#a6d4ee', G: '#7cb6e8', e: '#e3f2fb', m: '#fffdf7', M: '#e6e2d6', w: '#ffffff' }],
  '🥤': ['food-milk-tea-cup', 'Trà sữa', [
    '.......ss.', '......s...', '.....s....', '..LLLsLL..', 'LLLLLLLLLL', '.cwcccccC.', '.cwcccccC.',
    '.bbbbbbbB.', '..cccccC..', '..cccccC..', '..CCCCCC..',
  ], { s: '#f4c24f', L: '#e9eef5', c: '#e86f6f', C: '#c25555', w: '#ffb3b3', b: '#fff3e3', B: '#dcc0a0' }],
  '🥩': ['food-meat', 'Thịt', [
    '...ffffff...', '.ffrrrrrrff.', 'frwrrrrrrrrF', 'frwrrrrbbrrF', 'frrrrrrbbrRF', 'frrrrrrrrRRF',
    '.frrrrrrRRF.', '..FFRRRRFF..', '....FFFF....',
  ], { f: '#fff3e3', F: '#dcc0a0', r: '#e84a5f', R: '#c23a4e', w: '#ff8fa0', b: '#fffaf3' }],
  '🥫': ['food-can', 'Đồ hộp', [
    '.gggggggg.', 'gwgggggggG', 'GGGGGGGGGG', 'rrrrrrrrrR', 'rwrrrrrrrR', 'rwcccccrrR', 'rrccecccrR',
    'rrcccccrRR', 'rrrrrrrrRR', 'gggggggggG', '.GGGGGGGG.',
  ], { g: '#b9c2cc', G: '#8a96a3', w: '#ffb3b3', r: '#e86f6f', R: '#c25555', c: '#fff3e3', e: '#6dbb5a' }],
  '🥭': ['food-mango', 'Xoài', [
    '......tgg..', '...rrrtgGg.', '..rwrrooo..', '.rwrroooooo', '.rrroooooyY', 'rrroooooyyY', 'rrooooooyyY',
    'rooooooyyYY', '.oooooyyYY.', '..ooyyYYY..', '....YYYY...',
  ], { r: '#f0663c', w: '#ffb38a', o: '#ffa53d', y: '#ffd75e', Y: '#e0a422', t: '#9b6238', g: '#6dbb5a', G: '#4e9a45' }],
  '🥮': ['food-mooncake', 'Bánh nướng', [
    '....cccc....', '..hccccccc..', '.hccccccccC.', 'hcccddddcccC', 'cccdccccdccC', 'cccdcddcdccC',
    'cccdcddcdccC', 'cccdccccdcCC', 'ccccddddccCC', '.cccccccCCC.', '..ccccCCCC..', '....CCCC....',
  ], { c: '#e0a050', C: '#b97535', h: '#f6cf8a', d: '#b97535' }],
  '🧂': ['food-salt', 'Muối', [
    '..gggg..', '.gkgkgG.', '.GGGGGG.', '..bbbb..', '.bwbbbB.', 'bwbbbbbB', 'bssssssB', 'bwssssSB',
    'bssssssB', 'bssssSSB', '.BBBBBB.',
  ], { g: '#b9c2cc', G: '#8a96a3', k: K, b: '#cfe8f5', B: '#9fc6de', w: '#ffffff', s: '#ffffff', S: '#e6e9f0' }],
  '🧃': ['food-juice-box', 'Nước tăng lực', [
    '......s..', '.....s...', '....s....', '.ggggsgd.', '.gGGGGGd.', '.gGoooGd.', '.gGoOoGd.',
    '.gGoooGd.', '.gGGGGGd.', '.ggggggd.', '.ddddddd.',
  ], { g: '#7cc576', G: '#c9ecb0', d: '#4e9a45', o: '#ffa53d', O: '#ffd75e', s: '#f4f4f4' }],
  '🫘': ['food-beans', 'Đậu', [
    '.rrrr...rrrr.', 'rwrrrR.rwrrrR', 'rrrrRR.rrrrRR', '.RRRR...RRRR.', '.............', '....rrrr.....',
    '...rwrrrR....', '...rrrrRR....', '....RRRR.....',
  ], { r: '#c25555', R: '#8f3a3a', w: '#e88a8a' }],
  '🫙': ['food-jar', 'Hũ', [
    '.tttttttt.', '.ttwttttT.', '.TTTTTTTT.', '..gggggg..', '.gwgggggG.',
    'gwgggggggG', 'gwgggggggG', 'gwgggggggG', 'ggggggggGG', 'gggggggggG', '.gggggggG.', '..GGGGGG..',
  ], { t: '#c8915f', T: '#9b6238', w: '#ffffff', g: GLASS.g, G: GLASS.G }],
  '🧪': ['food-test-tube', 'Hóa chất', [
    'gggggggg', '.gwgggG.', '.gwgggG.', '.gwgggG.', '.lllllL.', '.lwlllL.', '.lwlbLL.', '.llllLL.',
    '.lbllLL.', '..lllL..', '...LL...',
  ], { g: '#e8f4fc', G: '#b9d6e8', w: '#ffffff', l: '#c79bf2', L: '#9a6bd0', b: '#efe3fd' }],
  '💊': ['food-medicine', 'Thuốc', [
    '..ccccC..', '..ccccC..', '.bbbbbbB.', '.bwbbbbB.', '.bLLLLLB.', '.bLLrLLB.', '.bLrrrLB.',
    '.bLLrLLB.', '.bLLLLLB.', '.bbbbbbB.', '.BBBBBBB.',
  ], { c: '#f0663c', C: '#c84a28', b: '#f6c46a', B: '#d99a3a', w: '#fff3cc', L: '#ffffff', r: '#e84a5f' }],
  '🩹': ['food-bandage', 'Băng cá nhân', [
    '..........bb.', '.........bwbB', '........bwhbB', '.......bwbhB.', '......bpppB..', '.....bpppB...',
    '....bpppB....', '...bwhbB.....', '..bwbhB......', '.bwhbB.......', '.bbB.........',
  ], { b: '#f6c99a', B: '#d9a06a', w: '#ffe3c4', h: '#d9a06a', p: '#fffaf3' }],
  '🩺': ['food-stethoscope', 'Phòng khám', [
    '.s......s....', '.t......t....', '.t......t....', '.t......t....', '..t....t.....', '...tttt......',
    '.....t.......', '.....t...sss.', '.....t..swssS', '.....t..sssSS', '......tt.SSS.',
  ], { t: '#e86f6f', s: '#b9c2cc', S: '#8a96a3', w: '#ffffff' }],
  '🧴': ['food-lotion', 'Đồ chăm sóc', [
    '.gggg....', '....g....', '...ggg...', '...ggG...', '..GGGGG..', '.mmmmmmm.', 'mwmmmmmmM',
    'mwmlllmmM', 'mmmlplmmM', 'mmmlllmmM', 'mmmmmmmmM', 'mmmmmmmMM', '.MMMMMMM.',
  ], { g: '#f4a3b4', G: '#d9708a', m: '#8fd3bf', M: '#4fae93', w: '#d6f3ea', l: '#fffaf3', p: '#f4a3b4' }],
  '🛁': ['food-bath', 'Tắm', [
    '..b...bb.....', '.bwb.bwwb.b..', '..b...bb.bwb.', 'ttttttttttttt', '.tWWWWWWWWWT.', '.tWWWWWWWWWT.',
    '..tWWWWWWWT..', '...TTTTTTT...', '..f.......f..',
  ], { b: '#bfe9fb', w: '#ffffff', t: '#9fd8f0', T: '#6fb6d8', W: '#e8f8ff', f: '#c9a24b' }],
  '🫧': ['food-bubbles', 'Sạch sẽ', [
    '...bb....bbbb.', '..bwib..biwiib', '..biib..bwiiib', '...bb...biiipb', '........biippb', '..bbbb...bbbb.',
    '.biiiib.......', 'biwwiiib......', 'biwiiiib......', 'biiiiiib......', 'biiiippb......', '.biippb.......',
    '..bbbb........',
  ], { b: '#7cc4e8', i: '#e3f4fc', w: '#ffffff', p: '#f6cde2' }],
  '🦠': ['food-germ', 'Vi khuẩn', [
    '.....gg.....', '.gg.gggg.gg.', '.gglgggggGG.', '..lggggggG..', '.gggkggkggG.', 'gggggggggggG',
    'gggpggggpgGG', '.ggggkkgggG.', '..gggggggG..', '.gGgggggGGG.', '.GG.GGGG.GG.', '.....GG.....',
  ], { g: '#8fd36a', G: '#5fa84a', l: '#c9f0a8', k: K, p: '#f4a3b4' }],
  '🧠': ['food-brain', 'Thông minh', [
    '..ppp..ppp..', '.pwppPpppPp.', 'pwpPpppPpppP', 'pppPppPPpPpP', 'ppPpppppPppP', 'pppppPpppPPP',
    '.ppPPpppPPP.', '..pppppPPP..', '.....pPP....',
  ], { p: '#f4a3b4', P: '#d9708a', w: '#ffe1ea' }],
};
