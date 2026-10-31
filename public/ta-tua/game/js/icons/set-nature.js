// Bộ icon nhóm "nature". Định dạng và quy tắc vẽ: xem index.js và set-samples.js.
const K = '#2e1d14';
const LEAF = { g: '#6dbb5a', G: '#4e9a45', l: '#a8e08f' };

export default {
  '🐉': ['dragon-head', 'Rồng', [
    '.y.y.....y.y.', '..yy.rrr.yy..', '...yggrggy...', '.rglgggggggr.', 'rrlggggggggGr', 'rgggkgggkgggr',
    '.ggggggggggG.', '.gmmmmmmmmgG.', 'gmmmkmmmkmmmG', 'gmmmmmmmmmmmG', 'yGmmmmmmmmmGy', 'y.GGGGGGGGG.y',
  ], { g: '#5fbf8a', G: '#3f9a6c', l: '#a8e8c4', m: '#fff3c4', r: '#e86f6f', y: '#f4c24f', Y: '#d79c1c', k: K }],
  '🐋': ['whale', 'Cá voi', [
    '....w.w.......', '.....w........', '...bbbbbb...bB', '.bbhhbbbbbb.bB', 'bbhbbbbbbbbbbB', 'bbkbbbbbbbbbB.',
    'bbbbbbbbbbbbB.', 'cccccccccbbB..', '.ccccccccBB...', '..BBBBBBB.....',
  ], { b: '#7cb6e8', B: '#4f8fd6', h: '#d6ecfa', c: '#e6f3fb', w: '#bfe3f2', k: K }],
  '🐚': ['seashell', 'Vỏ sò', [
    '..pp.ppp.pp..', '.pwwpppppppp.', 'pwwPppPppPppP', 'pwpPppPppPppP', 'pppPppPppPppP', '.ppPppPppPpP.',
    '..ppPpPpPppP.', '...ppPPPpPP..', '....ccccc....', '.....CCC.....',
  ], { p: '#f4a3b4', P: '#d9708a', w: '#ffe1ea', c: '#f4c7a8', C: '#c8915f' }],
  '🐛': ['caterpillar', 'Sâu', [
    '..........y.y.', '..........ggg.', '.........glggG', '.gg.gg.gggkgkG', 'gllGlgGlgggpgG', 'gggGggGgggggG.',
    '.GGGGGGGGGGG..', '.G..G..G..G...',
  ], { g: '#8fd36a', G: '#4e9a45', l: '#c8f0a0', y: '#e86f6f', p: '#f4a3b4', k: K }],
  '🐟': ['fish-blue', 'Cá', [
    '.....FF.......', '...ffffff...tt', '..fwwffffff.tT', '.fkfffffffftTT', 'ffffffffffftT.', '.fbbbbbbbbftTT',
    '..bbbbbbbbF.tT', '...FFFFFF...tt',
  ], { f: '#7cb6e8', F: '#4f8fd6', b: '#e6f3fb', w: '#d6ecfa', t: '#5a93cf', T: '#3f78b8', k: K }],
  '🐣': ['chick-hatching', 'Gà con nở', [
    '......y.....', '....yyyy....', '...yyyyyy...', '..ywyyyyyy..', '..yykyykyY..', '..yyyoOyyY..',
    'e.pyyyyyyp.e', 'eeeyeyyeyeee', 'ehheeeeeeeeE', 'eheeeeeeeeeE', '.eeeeeeeeeE.', '..EEEEEEEE..',
  ], { y: '#ffd75e', Y: '#e0a422', w: '#fff6c9', o: '#f0883c', O: '#d96a2a', p: '#f7a8a0', e: '#fffaf3', E: '#dcc0a0', h: '#ffffff', k: K }],
  '🐦‍🔥': ['phoenix', 'Phượng hoàng', [
    '......y......', 'r....yoy....r', 'rr..ooooo..rr', 'orr.okoko.rro', 'oorrooyoorroo', 'yoorrooorrooy',
    '.yoorrrrrooy.', '..yyorrroyy..', '....orrro....', '...oorRroo...', '..yo.rRr.oy..', '.y...yRy...y.', '......y......',
  ], { r: '#e84a5f', R: '#c23a4a', o: '#ff9a3c', y: '#ffd75e', k: K }],
  '🐯': ['tiger-face', 'Hổ', [
    '.oo.......oo.', 'opoooooooopoO', 'owookokokooOO', 'ooooookooooOO', 'ooooooooooooO', 'oookoooookooO',
    'okkowwwwwokkO', 'ooowwwpwwwoOO', 'okkowwkwwokkO', '.ooowwwwwoOO.', '..OOOOOOOOO..',
  ], { o: '#ff9a3c', O: '#d9702a', w: '#fff3e3', p: '#f4a3b4', k: K }],
  '🐷': ['pig-face', 'Heo', [
    '.pp.......pp.', 'pPpppppppppPP', 'pwwppppppppPP', 'pwppppppppppP', 'pppkpppppkppP', 'ppppppppppppP',
    'pppsssssssppP', 'pppsskskssppP', 'pppsssssssppP', '.ppppppppppP.', '..PPPPPPPPP..',
  ], { p: '#f9b8c6', P: '#d9708a', w: '#ffe1ea', s: '#ef8ba3', k: K }],
  '🦅': ['eagle', 'Đại bàng', [
    '.....wwww....', '...wwwwwwww..', '..wwwwwwwwwW.', '.yywkwwwwwwW.', 'yyyywwwwwwwwW', '.YYywwwwwbbbB',
    '...wwwwwbbbbB', '...wwwwbbbbbB', '..bbwwbbbbbbB', '..bbbbbbbbbbB', '.bbbbbbbbbbBB', '.BBBBBBBBBBB.',
  ], { w: '#fffaf3', W: '#dcc0a0', b: '#9b6238', B: '#7a4a2a', y: '#f4c24f', Y: '#d79c1c', k: K }],
  '🦇': ['bat', 'Dơi', [
    '....v....v....', '....vvvvvv....', 'W..vvkvvkvv..W', 'WW.vvvvvvvv.WW', 'WwWWvvvvvvWWWW', 'WWWWWvvvvWWWWW',
    'W.WW.vvvv.WW.W', '..W...vv...W..',
  ], { v: '#a48fcf', W: '#6d5a96', w: '#b6a4dd', k: K }],
  '🦋': ['butterfly', 'Bướm', [
    '....k...k....', '.bbb.k.k.bbb.', 'bwwbb.d.bbbbB', 'bwcbbbdbbbcbB', 'bbbbbbdbbbbbB', '.bbbbBdBbbBB.',
    '..uuuuduuuU..', '.uucuuduucuU.', '.uuuu.d.uuUU.', '..uu.....UU..',
  ], { b: '#7cb6e8', B: '#4f8fd6', w: '#e6f3fb', c: '#ffd75e', u: '#5a93d8', U: '#3f6fb8', d: '#3d2a1f', k: K }],
  '🦘': ['kangaroo-jump', 'Nhảy', [
    '.......t.t..', '.......ttt..', '......twktt.', '......tttttk', '.....ttttTT.', '....tttTT...',
    '...ttccctt..', '...tccccT...', '..ttccccT...', '..tttcctT...', 'tttttttTT...', 't...tTTTTTT.',
  ], { t: '#e0a46a', T: '#b97a45', c: '#fff3e3', w: '#f6d2a8', k: K }],
  '🦚': ['peacock', 'Công', [
    '....ggggg....', '..lgyggggyg..', '.lggggyggggGG', 'gyggggcggggyG', 'ggggybbbygggG', 'ggggbkbkbgggG',
    '.gggbbobbggG.', '..gggbbbbgG..', '....bbbbB....', '....bbbbB....', '.....bbB.....', '.....o.o.....',
  ], { g: '#4fae93', G: '#2f8a73', l: '#8fd3bf', y: '#ffd75e', c: '#ffd75e', b: '#3f78c8', B: '#2c5aa0', o: '#f4a33c', k: K }],
  '🦦': ['otter', 'Rái cá', [
    '...tttttttt...', '.ttwwtttttttT.', 'dtwttttttttttd', 'tttkttttttkttT', 'ttccccccccccTT', 'tccccckkcccccT',
    'tcdcdkcckdcdcT', '.tcccckkccccT.', '..tccccccccT..', '...TTTTTTTT...',
  ], { t: '#a86f45', T: '#7a4a2a', w: '#d9a77a', c: '#f6e2c8', d: '#8a5a3a', k: K }],
  '🕊': ['dove', 'Bồ câu', [
    '.........wW...', '........wwwW..', '..www..wwwwW..', '.wwkww.wwwwW..', 'yywwwwwwwwwwW.', '..wwwwwwwwwwwW',
    '...wwwwwwwwWWW', '....WWWWWWW.WW',
  ], { w: '#fffaf3', W: '#cfd6de', y: '#f0a04b', k: K }],
  '🪽': ['wing-angel', 'Cánh', [
    '.........wwww', '......wwwwwwW', '....wwwwwwwwW', '..wwwwwwwwwwW', '.sssssswwwwW.', 'wwwwwwwwwwwW.',
    '.ssssssswwW..', 'wwwwwwwwwWW..', '..ssssswwW...', '....wwwwW....',
  ], { w: '#fffaf3', W: '#cfd6de', s: '#bfd3e6' }],
  '🌱': ['seedling', 'Mầm cây', [
    '.ggg...ggg.', 'glggg.ggggG', '.gggg.gggG.', '..gggsggG..', '.....s.....', '.....s.....',
    '...uuttt...', '.tuttttttT.', 'tttttttttTT',
  ], { ...LEAF, s: '#4e9a45', t: '#9b6238', T: '#7a4a2a', u: '#c8915f' }],
  '🌲': ['tree-pine', 'Rừng thông', [
    '.....g.....', '....ggg....', '...glggG...', '..gggggGG..', '...ggggG...', '..glggggG..',
    '.gggggggGGG', '..ggggggG..', '.glgggggggG', 'gggggggggGG', '.GGGGGGGGG.', '....ttT....', '....ttT....',
  ], { g: '#58a85a', G: '#3d8445', l: '#9bd88a', t: '#9b6238', T: '#7a4a2a' }],
  '🌸': ['blossom', 'Hoa anh đào', [
    '....pp.pp....', '....ppppP....', 'pp...ppP...pp', 'pwpp.ppP.pppP', '.ppppcccppPP.', '..pppcycpPP..',
    '...ppcccPP...', '..pppp.pppP..', '.pppP...ppPP.', '.pp......PP..',
  ], { p: '#f9b8c8', P: '#e58aa3', w: '#ffe8ef', c: '#ffd75e', y: '#e0a422' }],
  '🌺': ['hibiscus', 'Hoa dâm bụt', [
    '...rrr.rrr...', '..rwrrRrrrRyy', 'rrrwrrRrrryR.', 'rwrrrrRrryrRR', 'rrrrrrrryrrrR', '.RRrrrcyrRRR.',
    'rrrrrRcrrrrrR', 'rrrrrRrRrrrRR', '.rrrrR.RrrrR.', '..rrrR.RrrR..', '...RR...RR...',
  ], { r: '#ef5a6e', R: '#c23a50', w: '#ff9fae', y: '#ffd75e', c: '#9b2a3a' }],
  '🌾': ['rice-ear', 'Lúa', [
    '.....y.....', '....yyy....', '..wy.Y.yY..', '..yy.Y.yY..', '...yyYyY...', '..wy.Y.yY..',
    '..yy.Y.yY..', '...yyYyY...', '.....s.....', '..gg.s.....', '...ggs.gg..', '.....sgg...', '.....s.....',
  ], { y: '#f4c24f', Y: '#c8901c', w: '#fff3c4', s: '#a8902a', g: '#a8c060' }],
  '🌿': ['herb', 'Lá thảo mộc', [
    '....ggg....', '...glggG...', '....ggG....', '.gg..s.....', 'glggss..gg.', '.gGG.s.gggG',
    '.....sgGG..', '.gg..s.....', 'glggss.....', '.gGG.s.....', '.....s.....', '.....s.....',
  ], { ...LEAF, s: '#3d7a35' }],
  '🍀': ['clover', 'Cỏ bốn lá', [
    '..gg...gg..', '.glgg.glgG.', '.gggG.gggG.', '..gGgGgGG..', '...gGGGg...', '..ggGGGgg..',
    '.glggGgggG.', '.ggggGggGG.', '..gGG.gGGs.', '........s..', '.........s.',
  ], { ...LEAF, s: '#3d7a35' }],
  '🍂': ['leaves-autumn', 'Lá khô', [
    '.......oooo', '.....oooovO', '...owooovOO', '..owooovOOO', '..oooovOOO.', '.oooovOOOO.',
    '.ooovOOOO..', '.oovOOOO.bb', '.ovOOO..bbB', '.vO....bbB.', 'v.....bB...',
  ], { o: '#f0a04b', O: '#d0702f', w: '#ffd59a', v: '#9b5a2a', b: '#b9733a', B: '#8a4e26' }],
  '🍃': ['leaves-tea', 'Lá trà', [
    '.......oooo', '.....oooovO', '...owooovOO', '..owooovOOO', '..oooovOOO.', '.oooovOOOO.',
    '.ooovOOOO..', '.oovOOOO.bb', '.ovOOO..bbB', '.vO....bbB.', 'v.....bB...',
  ], { o: '#6dbb5a', O: '#4e9a45', w: '#a8e08f', v: '#3d7a35', b: '#8fd36a', B: '#5aa84a' }],
  '🍄': ['mushroom', 'Nấm', [
    '....rrrrr....', '..rrhhrrrrr..', '.rhhrrrwwrrR.', 'rrhrrrrwwrrRR', 'rwwrrrrrrrwwR', 'rwwrrrrrrrwwR',
    '.RRRRRRRRRRR.', '....ccccC....', '....ccccC....', '...cccccCC...', '...CCCCCCC...',
  ], { r: '#e84a5f', R: '#b8364a', h: '#ff8fa0', w: '#fffaf3', c: '#fff3e3', C: '#dcc0a0' }],
  '🪷': ['lotus', 'Hoa sen', [
    '......p......', '.....pwP.....', 'p...ppwpP...P', 'pp.qppppPq.PP', 'ppqqqpppPqqPP', '.pqqqqpPqqqP.',
    '..ppqqqqqqP..', 'gggppppppPggg', '.gggggggggGG.',
  ], { p: '#f9b8c8', P: '#e58aa3', q: '#f08aa8', w: '#ffe8ef', g: '#6dbb5a', G: '#4e9a45' }],
  '🎋': ['sugarcane', 'Mía', [
    '.....g....g.', '......g..g..', '.g..g..gg...', '..g..g.cC...', '...gg..cC...', '...cC..nN...',
    '...cC..cC...', '...nN..cC...', '...cC..cC...', '...cC..nN...', '...cC..cC...', '...nN..cC...',
    '...cC..cC...', '...cC..cC...',
  ], { c: '#9b6a8a', C: '#734a68', n: '#e8d7a0', N: '#c8b27a', g: '#6dbb5a' }],
  '🪵': ['wood-log', 'Gỗ', [
    '.eeettttttttt.', 'eerrehhhhhhhht', 'ereertttdttttT', 'erRerttttttdtT', 'ereertdttttttT', 'eerreTTTTTTTTT',
    '.eeeTTTTTTTTT.',
  ], { e: '#f6d7a0', r: '#c8915f', R: '#9b6238', t: '#9b6238', T: '#6e4126', h: '#c8915f', d: '#7a4a2a' }],
  '🪨': ['rock', 'Đá', [
    '....ggggg....', '..ghhggggG...', '.ghhgggggGG..', '.hggggggggGG.', 'ggogggGgggGGG', 'gggggGggogGGG',
    'gggggggggGGGG', '.GGGGGGGGGGG.',
  ], { g: '#b9c2cc', G: '#8a96a3', h: '#e3e8ee', o: '#c2774a' }],
};
