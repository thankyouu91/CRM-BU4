// Bộ icon nhóm "places": nhà cửa, phong cảnh, thời tiết, xe cộ, đồ trong nhà. Định dạng và quy tắc vẽ: xem index.js và set-samples.js.
export default {
  '☀': ['wx-sun', 'Nắng', [
    '......y.......', '.y....y....y..', '..y.......y...', '....ooooo.....', '...owwooooO...', '...owoooooO...',
    'yy.oooooooO.yy', '...oooooooO...', '...ooooooOO...', '....OOOOOO....', '..y.......y...', '.y....y....y..',
    '......y.......',
  ], { y: '#ffd75e', o: '#f4c24f', O: '#d79c1c', w: '#fff6c9' }],
  '☁': ['wx-cloud', 'Mây', [
    '.....wwww.....', '....whhwww....', '..wwhwwwwwww..', '.wwhwwwwwwwwww', 'whwwwwwwwwwwwc', 'wwwwwwwwwwwwwc',
    'wwwwwwwwwwwwcc', '.cwwwwwwwwwcc.', '..cccccccccc..',
  ], { w: '#eef3f8', h: '#ffffff', c: '#b9c8d6' }],
  '⛅': ['wx-sun-cloud', 'Nắng có mây', [
    '..........y...', '......y.oooo.y', '.......oowoooO', '......owoooooO', '...wwww.oooooO', '..whhwwwwooooO',
    '.whwwwwwwwwwoO', 'whwwwwwwwwwwwc', 'wwwwwwwwwwwwwc', 'wwwwwwwwwwwwcc', '.cccccccccccc.',
  ], { y: '#ffd75e', o: '#f4c24f', O: '#d79c1c', w: '#eef3f8', h: '#ffffff', c: '#b9c8d6' }],
  '🌤': ['wx-sun-small-cloud', 'Trời nắng nhẹ', [
    'y....y....y...', '.y.ooooo.y....', '..oWWooooO....', '.oWoooooooO...', '.oWoooooooO.y.', 'yoooooooooO...',
    '.oooooowwww...', '.ooooowhhwwww.', '..OOowhwwwwwww', '...whwwwwwwwwc', '...wwwwwwwwwcc', '....cccccccc..',
  ], { y: '#ffd75e', o: '#f4c24f', O: '#d79c1c', W: '#fff6c9', w: '#eef3f8', h: '#ffffff', c: '#b9c8d6' }],
  '🌧': ['wx-rain', 'Mưa', [
    '....hhhh......', '..hhhccccc....', '.hhcccccccc...', '.hcccccccccccc', 'hccccccccccccC', 'cccccccccccccC',
    '.CCCCCCCCCCCC.', '..............', '..b....b....b.', '..B....B....B.', '..............', '.....b....b...',
    '.....B....B...',
  ], { h: '#dfe5eb', c: '#b9c2cc', C: '#8a96a3', b: '#bfe3f2', B: '#7cb6e8' }],
  '🌬': ['wx-wind', 'Gió', [
    '.........ggg..', '.wwwwwww.gglgG', 'wwssssss..ggG.', '..............', '...wwwwwwwwww.', '..wwssssssssss',
    '..............', 'wwwwwwwww.....', '.wwsssssss....',
  ], { w: '#e6f3fb', s: '#7cb6e8', g: '#6dbb5a', G: '#4e9a45', l: '#a8e08f' }],
  '🌈': ['wx-rainbow', 'Cầu vồng', [
    '...rrrrrrrr...', '..rroooooorr..', '.rooyyyyyyoor.', 'rroyggggggyorr', 'royggbbbbggyor', 'wwygb....bgyww',
    'whwwb....bwhww', 'cccc......cccc',
  ], { r: '#e86f6f', o: '#ffa55c', y: '#ffd75e', g: '#6dbb5a', b: '#7cb6e8', w: '#eef3f8', h: '#ffffff', c: '#b9c8d6' }],
  '🌊': ['sea-wave', 'Sóng biển', [
    '......wwwww...', '....wwbbbbbww.', '...wbbbbbbbbbw', '..wbbbbbbbbBBw', '.wbbbbbbbbB..w', '.bbbbbbbbbB...',
    'bbbbbbbbbbbB..', 'bbbbbbbbbbbbB.', 'wwbbwwwbbwwbbB', 'bbbbbbbbbbbbbB', 'BBBBBBBBBBBBBB',
  ], { b: '#7cb6e8', B: '#4f8fd6', w: '#e6f3fb' }],
  '🌙': ['moon-night', 'Ca đêm', [
    '....yyyy....', '..yyyy......', '.ywyy.......', '.ywy........', 'ywyy........', 'yyyy........',
    'yyyy.......Y', 'yyyyy.....YY', '.yyyyy...yYY', '.yyyyyyyyyY.', '..YyyyyyYY..', '....YYYY....',
  ], { y: '#ffd75e', Y: '#e0a422', w: '#fff6c9' }],
  '🌌': ['sky-galaxy', 'Dải ngân hà', [
    '.nnnnnnnnnnnn.', 'nnnnnnnnnnwnnN', 'nnwnnnnpppnnnN', 'nnnnnppvvppnnN', 'nnnnpvvwvvpnnN', 'nnnppvvvvpnnnN',
    'nnppvwvvppnnwN', 'nppvvvvppnnnnN', 'nnpvvppnnnwnnN', 'nwnppnnnnnnnnN', 'nnnnnnnnnnnnnN', '.NNNNNNNNNNNN.',
  ], { n: '#3b3f73', N: '#2a2d57', p: '#7a62b8', v: '#c79bf2', w: '#fff6c9' }],
  '🌆': ['city-dusk', 'Trung tâm', [
    '.pppppppppppp.', 'pppppppppyyppP', 'pppppppppyyppP', 'oooooooooooooO', 'oooggooooooooO', 'oogggoooggoooO',
    'ooggwogggggooO', 'ggggggggwggggG', 'ggwgggwggggwgG', 'ggggggggggwggG', 'gwggwggwgggggG', 'GGGGGGGGGGGGGG',
  ], { p: '#f4a3b4', P: '#d9708a', o: '#ffbe7a', O: '#e8955a', y: '#fff3c4', g: '#6b5a8c', G: '#4c3f6b', w: '#ffd75e' }],
  '🌉': ['bridge-arch', 'Cầu', [
    'r..r..r..r..r.', 'rrrrrrrrrrrrrr', 'RRRRRRRRRRRRRR', 'tttttttttttttT', 'tttwlllllltttT', 'ttwllllllllttT',
    'tlllllllllllTT', 'tlllllllllllTT', 'bbbbbbbbbbbbbb', 'bwwbbbbbbwwbbB', 'BBBBBBBBBBBBBB',
  ], { r: '#e86f6f', R: '#c25555', t: '#e2c9a0', T: '#b89a74', w: '#fff3e3', l: '#bfe3f2', b: '#7cb6e8', B: '#4f8fd6' }],
  '🌐': ['globe-world', 'Thế giới', [
    '....bbbbbb....', '..bwggbbbbbb..', '.bwggggbbbggB.', '.bgggbbbbgggB.', 'bbbggbbbbbggbB', 'bbbbgbbbbbbbbB',
    'bbbbbbbggbbbbB', 'bbbbbbggggbbbB', '.bbbbbbgggbbB.', '.bbbbbbbgbbBB.', '..bbbbbbbbBB..', '....BBBBBB....',
  ], { b: '#7cb6e8', B: '#4f8fd6', w: '#e6f3fb', g: '#6dbb5a' }],
  '⛰': ['mountain', 'Núi', [
    '......ww......', '.....wwWw.....', '....wwWggg....', '...wgggggggG..', '..wggggggggGG.', '..gggggggggGG.',
    '.gggggggggggGG', '.ggggggggggGGG', 'gggggggggggGGG', 'GGGGGGGGGGGGGG',
  ], { w: '#ffffff', W: '#dfe5eb', g: '#9aa6b2', G: '#6f7c8a' }],
  '⛱': ['beach-umbrella', 'Mái hiên sọc', [
    '.....rrww.....', '...rwwrrwwr...', '..rwwrrwwrrw..', '.rwwrrwwrrwwR.', 'RRWWRRWWRRWWRR', '.......t......',
    '.......t......', '.......t......', '.......t......', '.......t......', 'ssssssstssssss', 'SSSSSSSSSSSSSS',
  ], { r: '#e86f6f', R: '#c25555', w: '#fffaf3', W: '#dcc0a0', t: '#9b6238', s: '#f6e7c8', S: '#e2c9a0' }],
  '⛲': ['fountain', 'Đài phun nước', [
    '......ww......', '.....wbbw.....', '....wb..bw....', '...b..ss..b...', '..b..ssss..b..', '.....gGGg.....',
    '......gG......', 'gggggggggggggG', 'gbbbbbbbbbbbgG', 'gwbbbbbbbbbbgG', 'ggggggggggggGG', '.GGGGGGGGGGGG.',
  ], { w: '#e6f3fb', b: '#7cb6e8', s: '#bfe3f2', g: '#d8dde4', G: '#9aa6b2' }],
  '🏖': ['beach-coast', 'Ven biển', [
    '...gg..gg.....', '..gGggggGg....', '.g..ggg..g....', '.....t........', '.....t........', '.....t........',
    'bbbbbtbbbbbbbb', 'bwbbbtbbbwwbbB', 'ssssstsssssssS', 'sssssttssssssS', 'SSSSSSSSSSSSSS',
  ], { g: '#6dbb5a', G: '#4e9a45', t: '#9b6238', b: '#7cb6e8', B: '#4f8fd6', w: '#e6f3fb', s: '#f6e7c8', S: '#e2c9a0' }],
  '🏗': ['bldg-construction', 'Xây dựng', [
    'yyyyyyyyyyyyy.', 'yYyYyYyYyYyYy.', '..y.......g...', '..y.......g...', '..y......yyy..', '..y......yYy..',
    '..y...........', '..y.ttttttt...', '..y.t.t.t.t...', '..y.ttttttt...', '..y.t.t.t.t...', '.yyytttttttt..',
    'gggggggggggggG',
  ], { y: '#ffd75e', Y: '#d79c1c', g: '#8a96a3', G: '#6f7c8a', t: '#c8915f' }],
  '🏘': ['houses', 'Khu nhà', [
    '.........rr...', '........rrrr..', '..pp...rrrrrr.', '.pppp.RRRRRRRR', 'pppppp.wwwwww.', 'PPPPPPPwbbwdw.',
    '.wwwww.wbbwdw.', '.wbbww.wwwwdw.', '.wbbdw.WWWWWW.', '.wwwdw........', '.WWWWW........',
  ], { r: '#e86f6f', R: '#c25555', p: '#f4a3b4', P: '#d9708a', w: '#fff3e3', W: '#dcc0a0', b: '#bfe3f2', d: '#c8915f' }],
  '🏙': ['city-tall', 'Thành phố', [
    '.....gg.......', '....gggg......', '....glgg...hh.', '....gbgb..hhhh', '.hh.gggg..hbhH', 'hhhhgbgb..hhhH',
    'hbhhggggmmhbhH', 'hhhhgbgbmmhhhH', 'hbhhggggmbhbhH', 'hhhhgbgbmmhhhH', 'hbhhggggmbhbhH', 'HHHHGGGGMMHHHH',
  ], { g: '#8fb3d9', G: '#5f87b3', l: '#e6f3fb', b: '#fff3c4', h: '#b9c2cc', H: '#8a96a3', m: '#8fd3bf', M: '#4fae93' }],
  '🏚': ['bldg-warehouse', 'Kho hàng', [
    '......tt......', '....tttttt....', '..tttttttttt..', 'TTTTTTTTTTTTTT', '.ccccccccccc..', '.ccdddddddcC..',
    '.ccdDdDdDdcC..', '.ccdddddddcC..', '.ccdDdDdDdcC..', '.ccdddddddcC..', '.CCCCCCCCCCC..',
  ], { t: '#c8915f', T: '#9b6238', c: '#f6e7c8', C: '#dcc0a0', d: '#e2b07a', D: '#9b6238' }],
  '🏛': ['bldg-townhall', 'Tòa thị chính', [
    '......cc......', '....cccccc....', '..cwcccccccC..', 'CCCCCCCCCCCCCC', '.cc.cc.cc.cc..', '.cc.cc.cc.cC..',
    '.cc.cc.cc.cC..', '.cc.cc.cc.cC..', '.cc.cc.cc.cC..', 'cccccccccccccC', 'CCCCCCCCCCCCCC',
  ], { c: '#fff3e3', w: '#ffffff', C: '#c9b9a3' }],
  '🏞': ['scene-river', 'Ven sông', [
    'ssssssssssssss', 'ssssggsssssss.', 'sssggggssGGss.', 'ssgggggggGGGs.', 'sgggggbbggGGG.', 'llllllbbblllll',
    'lllllbbbbblltl', 'llllbbbbbbtttl', 'lllbbbbbbbbtll', 'llbbbbbbbbbbll', 'LLLLLLLLLLLLLL',
  ], { s: '#bfe3f2', g: '#9aa6b2', G: '#6f7c8a', l: '#6dbb5a', L: '#4e9a45', b: '#7cb6e8', t: '#4e9a45' }],
  '🏡': ['home-garden', 'Nhà có vườn', [
    '.....rr.......', '....rrrr......', '...rrrrrr..gg.', '..rrrrrrrrgglg', '.RRRRRRRRRRggG', '..wwwwwwwW.gG.',
    '..wbbwwddW..t.', '..wbbwwddW..t.', '..wwwwwddW..t.', 'f.f.f.f.f.f.f.', 'ffffffffffffff', 'llllllllllllll',
    'LLLLLLLLLLLLLL',
  ], { r: '#e86f6f', R: '#c25555', w: '#fff3e3', W: '#dcc0a0', b: '#bfe3f2', d: '#c8915f', g: '#6dbb5a', G: '#4e9a45', l: '#a8e08f', L: '#6dbb5a', t: '#9b6238', f: '#fffaf3' }],
  '🏦': ['bldg-bank', 'Ngân hàng', [
    '......gg......', '....gggggg....', '..gggggggggg..', 'GGGGGGGGGGGGGG', '.cccccccccccC.', '.cc.yyyyy.cC..',
    '.cc.ywyyY.cC..', '.cc.yyyyY.cC..', '.cc.YYYYY.cC..', '.cccccddcccC..', '.cccccddcccC..', 'CCCCCCCCCCCCCC',
  ], { g: '#8fd3bf', G: '#4fae93', c: '#fff3e3', C: '#c9b9a3', y: '#f4c24f', Y: '#d79c1c', w: '#fff3c4', d: '#c8915f' }],
  '🏪': ['bldg-supermarket', 'Siêu thị', [
    '.mmmmmmmmmmmM.', '.mwmmmmmmmmmM.', '.MMMMMMMMMMMM.', 'pwpwpwpwpwpwpw', 'PWPWPWPWPWPWPW', '.cccccccccccC.',
    '.cbbbbccddcC..', '.cbybbccddcC..', '.cbbrbccddcC..', '.cbbbbccddcC..', '.CCCCCCCCCCC..',
  ], { m: '#8fd3bf', M: '#4fae93', w: '#fffaf3', p: '#f4a3b4', P: '#d9708a', W: '#dcc0a0', c: '#fff3e3', C: '#dcc0a0', b: '#bfe3f2', d: '#c8915f', y: '#ffd75e', r: '#e86f6f' }],
  '🏫': ['bldg-school', 'Trường học', [
    '......yy......', '.....rrrr.....', '....rryyrr....', '....rryyrr....', '.rrrRRRRRRrrr.', 'RRRRwwwwwwRRRR',
    '.wwwwwwwwwwwW.', '.wbbwwddwwbbW.', '.wbbwwddwwbbW.', '.wwwwwddwwwwW.', '.WWWWWWWWWWWW.',
  ], { r: '#e86f6f', R: '#c25555', y: '#ffd75e', w: '#fff3e3', W: '#dcc0a0', b: '#bfe3f2', d: '#c8915f' }],
  '🏭': ['bldg-industrial', 'Khu công nghiệp', [
    '......s...s...', '.....ss..ss...', '.......s...s..', '.....hh..hh...', '.....hh..hh...', 'g..g.hhg.hh...',
    'gg.gg.ggghhg..', 'gggggggggggggG', 'gbbgbbgbbgbbgG', 'gbbgbbgbbgbbgG', 'ggggggggggddgG', 'GGGGGGGGGGGGGG',
  ], { s: '#dfe5eb', h: '#c25555', g: '#b9c2cc', G: '#8a96a3', b: '#ffd75e', d: '#6f7c8a' }],
  '🏮': ['lantern-red', 'Đèn lồng', [
    '.....yy.....', '...yyyyyy...', '..rrrrrrrr..', '.rwrrrrrrrR.', 'rrwrrRrrrrRR', 'rrrrrRrrrrRR',
    'rrrrrRrrrrRR', 'rrrrrRrrrrRR', '.rrrrRrrrrR.', '..rrrrrrRR..', '...yyyyyy...', '.....yy.....',
    '.....yy.....', '....y..y....',
  ], { r: '#e84a5f', R: '#b8344a', w: '#ff9aa6', y: '#f4c24f' }],
  '🏯': ['clan-castle', 'Gia tộc', [
    '......yy......', '.....mmmm.....', '...mmmmmmmm...', '..MMMMMMMMMM..', '....wdwwdw....', '....wwwwwW....',
    '.mmmmmmmmmmmm.', 'MMMMMMMMMMMMMM', '..wdwwddwwdW..', '..wwwwddwwwW..', '.ssssssssssss.', 'sssssssssssssS',
    'SSSSSSSSSSSSSS',
  ], { y: '#f4c24f', m: '#4fae93', M: '#367f6a', w: '#fff3e3', W: '#dcc0a0', d: '#9b6238', s: '#b9c2cc', S: '#8a96a3' }],
  '🕌': ['bldg-dome', 'Tòa nhà mái vòm', [
    '.....y......', '.....y......', '....mmm.....', '..mmlmmmm...', '.mlmmmmmmM..', 'mmmmmmmmmMM.',
    'MMMMMMMMMMM.', 'cccccccccccC', 'ccbcccccbccC', 'ccbccdcccbcC', 'ccccdddcccC.', 'ccccdddcccC.',
    'CCCCCCCCCCC.',
  ], { y: '#f4c24f', m: '#8fd3bf', M: '#4fae93', l: '#d4f2e8', c: '#fff3e3', C: '#dcc0a0', b: '#bfe3f2', d: '#c8915f' }],
  '🗼': ['tower-tall', 'Tháp cao', [
    '....r....', '....g....', '...ggG...', '...gGG...', '..ppppP..', '.pwbbbpP.',
    '..PPPPP..', '...ggG...', '...ggG...', '...ggG...', '..gggGG..', '.gggggGG.',
    'gggggggGG',
  ], { r: '#e84a5f', g: '#d8dde4', G: '#9aa6b2', p: '#f4a3b4', P: '#d9708a', w: '#ffe1ea', b: '#bfe3f2' }],
  '⚓': ['anchor', 'Mỏ neo', [
    '.....aaa.....', '....a...a....', '.....aaa.....', '......a......', '...aaaaaaa...', '......a......',
    '......a......', 'a.....a.....a', 'aa....a....aa', '.aa...a...aa.', '..aaaaAaaaa..', '....AAAAA....',
  ], { a: '#8a96a3', A: '#5f6b78' }],
  '✈': ['plane', 'Máy bay', [
    '..........ww.', '.........wwwb', '........wwwb.', 'ww.....wwwb..', 'wwb...wwwb...', '.wwwwwwwb....',
    '..wbbwwb.....', '...wwwwbb....', '....wwbwwb...', '...wwb..wwb..', '..wwb....bb..', '..bb.........',
  ], { w: '#f2f6fa', b: '#7cb6e8' }],
  '🚀': ['rocket', 'Tên lửa', [
    '.....r.....', '....rrr....', '...wwwwW...', '...wwwwW...', '..wwbbwwW..', '..wbwbbwW..',
    '..wwbbwwW..', '..wwwwwwW..', '.rwwwwwwWr.', 'rrwwwwwwWrr', 'rr.oyyo..rr', '....oyo....',
    '.....o.....',
  ], { r: '#e86f6f', w: '#f2f6fa', W: '#b9c2cc', b: '#7cb6e8', o: '#ffa55c', y: '#ffd75e' }],
  '🚆': ['train', 'Tàu hỏa', [
    '...mmmmmmm....', '..mmlmmmmmmM..', '..mbbbbbbbmM..', '..mbbbbbbbmM..', '..mbbbbbbbmM..', '..mmmmmmmmmM..',
    '..myymmmyymM..', '..mmmmmmmmmM..', '..MMMMMMMMMM..', '...g.....g....', '..ggg...ggg...', 'gggggggggggggg',
  ], { m: '#8fd3bf', M: '#4fae93', l: '#d4f2e8', b: '#bfe3f2', y: '#ffd75e', g: '#8a96a3' }],
  '🚗': ['car', 'Xe hơi', [
    '....rrrrrr....', '...rbbrbbbr...', '..rbbbrbbbbr..', '.rrrrrrrrrrrr.', 'rwrrrrrrrrrrrR', 'rrrrrrrrrrrrrR',
    'RRggRRRRRRggRR', '..gg......gg..',
  ], { r: '#e86f6f', R: '#c25555', b: '#bfe3f2', w: '#ffb3b3', g: '#4a4f57' }],
  '🚜': ['tractor', 'Máy cày', [
    '.......ttt....', '.......t.t....', '.......t.t..s.', '.......t.t..s.', '.gggggggggggg.', 'glgggggggggggG',
    'ggggggggggggGG', '.gkkkkgGGggkk.', 'kkyykkkk..kyyk', 'kyyyykk...kyyk', 'kyyyykk....kk.', '.kyykk........',
  ], { t: '#9b6238', s: '#8a96a3', g: '#6dbb5a', G: '#4e9a45', l: '#a8e08f', k: '#4a4f57', y: '#f4c24f' }],
  '🚢': ['ship', 'Tàu thủy', [
    '.......rr.....', '.......rr.....', '.......kk.....', '....wwwwwwww..', '....wbbwbbwW..', '...wwwwwwwwwW.',
    'rrrrrrrrrrrrrr', '.rrwrrrrrrrrR.', '..RRRRRRRRRR..', 'bbbbbbbbbbbbbb', 'bwwbbbbbwwbbbB',
  ], { r: '#e86f6f', R: '#c25555', k: '#4a4f57', w: '#fffaf3', W: '#dcc0a0', b: '#7cb6e8', B: '#4f8fd6' }],
  '⛽': ['fuel-pump', 'Cây xăng', [
    '.rrrrrrr.....', 'rwrrrrrrR....', 'rbbbbbbrR.g..', 'rbbbbbbrR.gg.', 'rrrrrrrrR..g.', 'rrrrrrrrRgg.g',
    'rryyyyrrR...g', 'rrrrrrrrR...g', 'rrrrrrrrR..gg', 'rrrrrrrrR.gg.', 'RRRRRRRRR....', 'gggggggggg...',
  ], { r: '#e86f6f', R: '#c25555', w: '#ffb3b3', b: '#bfe3f2', y: '#ffd75e', g: '#4a4f57' }],
  '🛢': ['oil-drum', 'Thùng dầu', [
    '.bbbbbbbb.', 'bllllllllB', 'bbbbbbbbbB', 'blbbbbbbbB', 'ggggggggGG', 'blbbbbbbbB',
    'bbbbbbbbbB', 'blbbbbbbbB', 'ggggggggGG', 'blbbbbbbbB', 'bbbbbbbbbB', '.BBBBBBBB.',
  ], { b: '#4f6d8a', B: '#34495e', l: '#7f9bb6', g: '#b9c2cc', G: '#8a96a3' }],
  '🚪': ['door', 'Cửa', [
    '.tttttttt.', 'tTTTTTTTTT', 'tdddddddTT', 'tdwddddddT', 'tdddddddTT', 'tddddddyTT',
    'tddddddyTT', 'tdddddddTT', 'tdddddddTT', 'tdddddddTT', 'tdddddddTT', 'TTTTTTTTTT',
  ], { t: '#9b6238', T: '#6e4428', d: '#c8915f', w: '#e2b07a', y: '#ffd75e' }],
  '🪟': ['window', 'Cửa sổ', [
    'tttttttttttt', 'tbbbbbtbbbbT', 'tbwbbbtbwbbT', 'tbbbbbtbbbbT', 'tbbbbbtbbbbT', 'ttttttttttTT',
    'tbbbbbtbbbbT', 'tbwbbbtbbbbT', 'tbbbbbtbbbbT', 'tbbbbbtbbbbT', 'TTTTTTTTTTTT',
  ], { t: '#fff3e3', T: '#dcc0a0', b: '#7cb6e8', w: '#e6f3fb' }],
  '🪧': ['sign-board', 'Biển hiệu', [
    'cccccccccccc', 'cwcccccccccC', 'ckkkkkkkkcC.', 'cccccccccccC', 'ckkkkkkcccC.', 'cccccccccccC',
    'CCCCCtCCCCCC', '.....tt.....', '.....tt.....', '.....tt.....', '.....tt.....', '....tttt....',
  ], { c: '#f6e7c8', C: '#e2c9a0', w: '#fffaf3', k: '#c8915f', t: '#9b6238' }],
  '🧱': ['bricks', 'Gạch', [
    'rrrrrmrrrrrmr', 'rwwrrmrrrrrmR', 'mmmmmmmmmmmmm', 'rrmrrrrrmrrrR', 'rrmrrrrrmrrrR', 'mmmmmmmmmmmmm',
    'rrrrrmrrrrrmr', 'rrrrrmrrrrrmR', 'mmmmmmmmmmmmm', 'rrmrrrrrmrrrR', 'RRmRRRRRmRRRR',
  ], { r: '#e0805f', R: '#b85a3e', w: '#f4a98a', m: '#f6e7c8' }],
  '🕯': ['candle', 'Nến', [
    '.....y...', '....yoy..', '....yoy..', '.....y...', '.....k...', '...ccccC.',
    '...wcccC.', '...wcccC.', '...ccccC.', '...ccccC.', '...ccccC.', 'ggggggggg',
    '.GGGGGGG.',
  ], { y: '#ffd75e', o: '#ffa55c', k: '#2e1d14', c: '#fff3e3', C: '#dcc0a0', w: '#ffffff', g: '#f4c24f', G: '#d79c1c' }],
};
