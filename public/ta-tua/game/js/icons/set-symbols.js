// Bộ icon nhóm "symbols" (dấu hiệu giao diện, trạng thái, phản hồi). Định dạng và quy tắc vẽ: xem index.js và set-samples.js.
// Chấm tròn và ô vuông màu (⚪ ⚫ 🟠 🟢 🟤 ⬜ 🟫 🔲 🔷 🔺) dùng làm chấm trạng thái, cùng khung 12×12 (ô vuông 11×11).
export default {
  '↩': ['arrow-reply', 'Trả lời', [
    '...B........', '..bB........', '.bbbbbbbB...', 'BbwwwbbbbB..', '.BbbBBBBbbB.', '..BB....BbB.',
    '...B.....BbB', '..........bB', '.........bbB', '.......bbbB.', '.......BBB..',
  ], { b: '#7cb6e8', B: '#4f8fc9', w: '#d6eefa' }],
  '▶': ['media-play', 'Chạy', [
    'bB.........', 'bbbB.......', 'bwbbbB.....', 'bwbbbbbB...', 'bwbbbbbbbB.', 'bbbbbbbbbbB',
    'bbbbbbbbBB.', 'bbbbbbBB...', 'bbbbBB.....', 'bbBB.......', 'BB.........',
  ], { b: '#7cb6e8', B: '#4f8fc9', w: '#d6eefa' }],
  '⏸': ['media-pause', 'Tạm dừng', [
    'bbbB..bbbB', 'bwbB..bwbB', 'bwbB..bwbB', 'bbbB..bbbB', 'bbbB..bbbB', 'bbbB..bbbB',
    'bbbB..bbbB', 'bbbB..bbbB', 'bbbB..bbbB', 'bbbB..bbbB', 'BBBB..BBBB',
  ], { b: '#7cb6e8', B: '#4f8fc9', w: '#d6eefa' }],
  '⏭': ['media-next', 'Tiếp theo', [
    'B....B.....bB', 'bB...bB....bB', 'wbB..bbB...bB', 'wbbB.wbbB..bB', 'bbbbbbbbbB.bB', 'bbbbbbbbbbBbB',
    'bbbbBbbbbB.bB', 'bbbB.bbbB..bB', 'bbB..bbB...bB', 'bB...bB....bB', 'B....B.....BB',
  ], { b: '#7cb6e8', B: '#4f8fc9', w: '#d6eefa' }],
  '⬆': ['arrow-up', 'Nâng lên', [
    '....bB....', '...bbbB...', '..bwbbbB..', '.bwwbbbbB.', 'bbbbbbbbbB', 'BBBbbbbBBB',
    '...bbbB...', '...bbbB...', '...bbbB...', '...bbbB...', '...bbbB...', '...BBBB...',
  ], { w: '#c4efae', b: '#6dbb5a', B: '#4e9a45' }],
  '🔁': ['arrow-repeat', 'Lặp lại', [
    '........B...', '.wwbbbbbbB..', 'wbBBBBBBbbB.', 'bB......bB..', 'BB......B...', '...B......bB',
    '..bB......bB', '.BbbbbbbbbbB', '..BbBBBBBBB.', '...B........',
  ], { b: '#7cb6e8', B: '#4f8fc9', w: '#d6eefa' }],
  '🔄': ['arrow-cycle', 'Xoay vòng', [
    '...wbbbB.B..', '..wbBBBBbbB.', '.wbB....bbB.', 'bbB....BBBB.', 'bB..........', 'BB..........',
    '..........bB', '..........bB', '.bbbB....bbB', '.bbB....bbB.', '.BbBbbbbbB..', '..B.BBBBB...',
  ], { b: '#6fcfb3', B: '#3f9c81', w: '#c8f2e4' }],
  '⏱': ['time-stopwatch', 'Bấm giờ', [
    '....gggG..G.', '....rggR..G.', '..rrrrrrrR..', '.rrwcccccrR.', '.rwccckcccR.', 'rrcccckcccrR',
    'rrcccckcccrR', 'rrcccckkkcrR', 'RrccccccccrR', '.rccccccccR.', '.RrccccccrR.', '..RRrrrrRR..',
    '....RRRR....',
  ], { r: '#e86f6f', R: '#c25555', w: '#ffb3b3', c: '#fffaf3', k: '#2e1d14', g: '#b9c2cc', G: '#8a96a3' }],
  '🕑': ['time-clock', 'Đồng hồ', [
    '.....sS.....', '....sssS....', '..swsssssS..', '.swcckccksS.', '.sccckckccS.', 'ssccckkcccsS',
    'ssccckkcccsS', 'ssccccccccsS', 'SsccccccccsS', '.sccccccccS.', '.SsccccccsS.', '..SSssssSS..',
    '....SSSS....',
  ], { s: '#7cb6e8', S: '#4f8fc9', w: '#d6eefa', c: '#fffaf3', k: '#2e1d14' }],
  '⏳': ['time-hourglass', 'Đang chờ', [
    'tttttttttt', 'TTTTTTTTTT', '.gwyyyyyg.', '.gyyyyyyg.', '..gyyyyg..', '...gyyg...',
    '....yy....', '...g..g...', '..g.yy.g..', '.gyyyyyyg.', 'tttttttttt', 'TTTTTTTTTT',
  ], { t: '#c8915f', T: '#9b6238', g: '#d6eefa', y: '#f4c24f', w: '#ffffff' }],
  '⚠': ['sign-warning', 'Cảnh báo', [
    '......Y......', '.....yyY.....', '.....wyY.....', '....yykyY....', '....wykyY....', '...yyykyyY...',
    '...yyykyyY...', '..yyyykyyyY..', '..yyyyyyyyY..', '.yyyyykyyyyY.', '.yyyyykyyyyY.', 'YYYYYYYYYYYYY',
  ], { y: '#ffd75e', Y: '#e0a422', w: '#fff6c9', k: '#2e1d14' }],
  '⛔': ['sign-no-entry', 'Cấm vào', [
    '....rrrr....', '..rrrrrrrR..', '.rrwrrrrrrR.', '.rwwrrrrrrR.', 'rrrrrrrrrrRR', 'rrccccccccRR',
    'rrcccccccCRR', 'rrrrrrrrrRRR', '.rrrrrrrrRR.', '.RrrrrrRRRR.', '..RRRRRRRR..', '....RRRR....',
  ], { r: '#e84a5f', R: '#b8384b', w: '#ff9aa5', c: '#fffaf3', C: '#e9d6c0' }],
  '🚫': ['sign-forbidden', 'Bị cấm', [
    '....rrrr....', '..rwrrrrrR..', '.rwrccccrrR.', '.wrrrccccrR.', 'rrcrrrccccRR', 'rrccrrrcccRR',
    'rrcccrrrccRR', 'rrccccrrrcRR', '.rrccccrrRR.', '.RrrccccRRR.', '..RRRRRRRR..', '....RRRR....',
  ], { r: '#e84a5f', R: '#b8384b', w: '#ff9aa5', c: '#fffaf3' }],
  '✅': ['mark-check', 'Xong', [
    '.gggggggggG.', 'gllgggggggGG', 'glgggggggwwG', 'ggggggggwwwG', 'gggggggwwwGG', 'gwwgggwwwgGG',
    'gwwwgwwwggGG', 'ggwwwwwgggGG', 'gggwwwggggGG', 'ggggwgggggGG', 'GgggggggggGG', '.GGGGGGGGGG.',
  ], { g: '#6dbb5a', G: '#4e9a45', l: '#a8e08f', w: '#fffaf3' }],
  '❌': ['mark-cross', 'Sai / Hủy', [
    '.rrrrrrrrrR.', 'rllrrrrrrrRR', 'rlwwrrrrwwRR', 'rrwwwrrwwwRR', 'rrrwwwwwwrRR', 'rrrrwwwwrrRR',
    'rrrrwwwwrrRR', 'rrrwwwwwwrRR', 'rrwwwrrwwwRR', 'rrwwrrrrwwRR', 'RrrrrrrrrrRR', '.RRRRRRRRRR.',
  ], { r: '#e86f6f', R: '#c25555', l: '#ffb3b3', w: '#fffaf3' }],
  '➕': ['mark-plus', 'Thêm', [
    '...wppP...', '...wppP...', '...pppP...', 'wwpppppppP', 'pppppppppP', 'pppppppppP',
    'PPPppppPPP', '...pppP...', '...pppP...', '...PPPP...',
  ], { p: '#6dbb5a', P: '#4e9a45', w: '#c4efae' }],
  '➖': ['mark-minus', 'Bớt', [
    'wwwppppppP', 'pppppppppP', 'pppppppppP', 'PPPPPPPPPP',
  ], { p: '#e86f6f', P: '#c25555', w: '#ffb3b3' }],
  '❓': ['mark-question', 'Câu hỏi', [
    '..rwrrrR..', '.rwrRRrrR.', 'rwrR..RrrR', 'RRR....rrR', '......rrrR', '.....rrrR.',
    '....rrrR..', '....RRR...', '..........', '....rrR...', '....RRR...',
  ], { r: '#e84a5f', R: '#b8384b', w: '#ff9aa5' }],
  '❗': ['mark-exclaim', 'Chú ý', [
    'wwrR', 'wrrR', 'rrrR', 'rrrR', 'RrrR', '.rR.',
    '.RR.', '....', 'rrrR', 'RRRR',
  ], { r: '#e84a5f', R: '#b8384b', w: '#ff9aa5' }],
  '❤': ['heart-red', 'Tim đỏ', [
    '.rrR...rrR.', 'rwwrR.rrrrR', 'rwrrrrrrrrR', 'rrrrrrrrrrR', 'RrrrrrrrrrR', '.RrrrrrrrR.',
    '..RrrrrrR..', '...RrrrR...', '....RrR....', '.....R.....',
  ], { r: '#e84a5f', R: '#b8384b', w: '#ff9aa5' }],
  '💚': ['heart-green', 'Tim xanh', [
    '.ggG...ggG.', 'gwwgG.ggggG', 'gwggggggggG', 'ggggggggggG', 'GgggggggggG', '.GgggggggG.',
    '..GgggggG..', '...GgggG...', '....GgG....', '.....G.....',
  ], { g: '#6dbb5a', G: '#4e9a45', w: '#c4efae' }],
  '💗': ['heart-glow', 'Tim hồng rung rinh', [
    '.ppP...ppP.', 'pwwpP.ppppP', 'pwpllpllppP', 'pplllllllpP', 'PplllllllpP', '.PplllllpP.',
    '..PplllpP..', '...PplpP...', '....PpP....', '.....P.....',
  ], { p: '#ef7fa0', P: '#d9708a', w: '#ffe1ea', l: '#ffc2d3' }],
  '💝': ['heart-gift', 'Tim quà tặng', [
    '...yy.yy...', '.ppPyYyppP.', 'pwwpP.ppppP', 'pwpppyppppP', 'pppppyppppP', 'yyyyyyyyyyY',
    '.PpppypppP.', '..PppyppP..', '...PpypP...', '....PyP....', '.....Y.....',
  ], { p: '#f4a3b4', P: '#d9708a', w: '#ffe1ea', y: '#f4c24f', Y: '#d79c1c' }],
  '⚪': ['dot-white', 'Chấm trắng', [
    '....cccc....', '..cccccccC..', '.ccwccccccC.', '.cwwccccccC.', 'ccccccccccCC', 'ccccccccccCC',
    'ccccccccccCC', 'cccccccccCCC', '.ccccccccCC.', '.CcccccCCCC.', '..CCCCCCCC..', '....CCCC....',
  ], { c: '#f3eee8', C: '#c9c2bb', w: '#ffffff' }],
  '⚫': ['dot-black', 'Chấm đen', [
    '....cccc....', '..cccccccC..', '.ccwccccccC.', '.cwwccccccC.', 'ccccccccccCC', 'ccccccccccCC',
    'ccccccccccCC', 'cccccccccCCC', '.ccccccccCC.', '.CcccccCCCC.', '..CCCCCCCC..', '....CCCC....',
  ], { c: '#4a4048', C: '#352d34', w: '#8a8090' }],
  '🟠': ['dot-orange', 'Chấm cam', [
    '....cccc....', '..cccccccC..', '.ccwccccccC.', '.cwwccccccC.', 'ccccccccccCC', 'ccccccccccCC',
    'ccccccccccCC', 'cccccccccCCC', '.ccccccccCC.', '.CcccccCCCC.', '..CCCCCCCC..', '....CCCC....',
  ], { c: '#f59a4a', C: '#d0742a', w: '#ffd2a6' }],
  '🟢': ['dot-green', 'Chấm xanh', [
    '....cccc....', '..cccccccC..', '.ccwccccccC.', '.cwwccccccC.', 'ccccccccccCC', 'ccccccccccCC',
    'ccccccccccCC', 'cccccccccCCC', '.ccccccccCC.', '.CcccccCCCC.', '..CCCCCCCC..', '....CCCC....',
  ], { c: '#6dbb5a', C: '#4e9a45', w: '#c4efae' }],
  '🟤': ['dot-brown', 'Chấm nâu', [
    '....cccc....', '..cccccccC..', '.ccwccccccC.', '.cwwccccccC.', 'ccccccccccCC', 'ccccccccccCC',
    'ccccccccccCC', 'cccccccccCCC', '.ccccccccCC.', '.CcccccCCCC.', '..CCCCCCCC..', '....CCCC....',
  ], { c: '#a86e44', C: '#7f4f2c', w: '#d9aa80' }],
  '⬜': ['chip-white', 'Ô trắng', [
    'ccccccccccC', 'cwwcccccccC', 'cwccccccccC', 'ccccccccccC', 'ccccccccccC', 'ccccccccccC',
    'ccccccccccC', 'ccccccccccC', 'ccccccccccC', 'ccccccccccC', 'CCCCCCCCCCC',
  ], { c: '#f3eee8', C: '#c9c2bb', w: '#ffffff' }],
  '🟫': ['chip-brown', 'Ô nâu', [
    'ccccccccccC', 'cwwcccccccC', 'cwccccccccC', 'ccccccccccC', 'ccccccccccC', 'ccccccccccC',
    'ccccccccccC', 'ccccccccccC', 'ccccccccccC', 'ccccccccccC', 'CCCCCCCCCCC',
  ], { c: '#a86e44', C: '#7f4f2c', w: '#d9aa80' }],
  '🔲': ['chip-frame', 'Ô khung', [
    'ccccccccccC', 'cwwcccccccC', 'cwccccccccC', 'ccclsssSccC', 'cccssssSccC', 'cccssssSccC',
    'cccssssSccC', 'cccSSSSSccC', 'ccccccccccC', 'ccccccccccC', 'CCCCCCCCCCC',
  ], { c: '#b9c2cc', C: '#8a96a3', w: '#e6ebf0', s: '#bfe3f2', S: '#7cb6e8', l: '#ffffff' }],
  '🔷': ['chip-diamond', 'Ô thoi xanh', [
    '.....BB.....', '....bBBB....', '...bbbBBB...', '..bbbwbBBB..', '.bbbwwbbBBB.', 'bbbbbbbbbBBB',
    'bbbbbbbbbBBB', '.bbbbbbbBBB.', '..bbbbbBBB..', '...bbbBBB...', '....bBBB....', '.....BB.....',
  ], { b: '#7cb6e8', B: '#4f8fc9', w: '#d6eefa' }],
  '🔺': ['chip-triangle', 'Ô tam giác', [
    '.....rR.....', '.....rR.....', '....rrrR....', '....rwrR....', '...rwrrrR...', '...rwrrrR...',
    '..rrrrrrrR..', '..rrrrrrrR..', '.rrrrrrrrrR.', '.rrrrrrrrrR.', 'RRRRRRRRRRRR',
  ], { r: '#e86f6f', R: '#c25555', w: '#ffb3b3' }],
  '✨': ['sparkles', 'Lấp lánh', [
    '..........Y..', '.........ywY.', '........YyyyY', '.........YyY.', '....Y.....Y..', '....Y........',
    '...yyY.......', '..ywwyY......', 'YYywyyyYY..wY', '..YyyyY....YY', '...YyY.......', '....Y........',
    '....Y........',
  ], { y: '#ffd75e', Y: '#e0a422', w: '#fff6c9' }],
  '✴': ['star-eight', 'Sao tám cánh', [
    '............', '.....oO.....', '..O..oO..O..', '...oooooO...', '...owoooO...', '.oooowwoooO.',
    '.OOoowoooOO.', '...oooooO...', '...OOooOO...', '..O..oO..O..', '.....OO.....', '............',
  ], { o: '#f59a4a', O: '#d0742a', w: '#ffe0b8' }],
  '🌟': ['star-glow', 'Sao sáng', [
    '......h....h..', '..............', 'h.....Y.....h.', '.....yyY......', '.....ywY......', '.YyyywwyyyyY.h',
    '..YyyyyyyyY...', '...yyyyyyY....', '...yyyYyyY....', '..yyyY.YyyY...', 'h.yYY...YYY...', '.YY.......YY..',
    '............h.', '.h....h.......',
  ], { y: '#ffd75e', Y: '#e0a422', w: '#fff6c9', h: '#ffe9a0' }],
  '🌠': ['star-shooting', 'Sao băng', [
    '..........Y...', '.........ywY..', '.......YywyyyY', '........yyyyY.', '......t.yYYYY.', '.....ttYY...YY',
    '....tt........', '...uu...u.....', '..uu...u......', '.vv...v.......', 'v....v........', '..............',
  ], { y: '#ffd75e', Y: '#e0a422', w: '#fff6c9', t: '#ffe9a0', u: '#bfe3f2', v: '#9fc6ee' }],
  '💥': ['fx-burst', 'Va chạm', [
    '....O........', '....oO...O...', '....oO..oO...', '....oooooO...', '.OoooyyyoO...', '..OoywwwyooO.',
    '...oywwwyoOOO', '...oywwwyO...', '.ooOOyyyoO...', '.OO..ooOOO...', '.....oO..OO..', '.....O.......',
    '.....O.......',
  ], { o: '#e86f6f', O: '#c25555', y: '#ffd75e', w: '#fff6c9' }],
  '💤': ['fx-sleep', 'Ngủ', [
    '.......wZzzZ', '.........zZ.', '........zZ..', '.......ZZZZZ', '............', 'wwZZzzZ.....',
    '....zzZ.....', '...zzZ......', '..zzZ.......', '.zzZ........', 'ZZZZZZZ.....',
  ], { z: '#9fc6ee', Z: '#6b9bd6', w: '#e3f1fb' }],
  '💨': ['fx-puff', 'Làn khí', [
    '.......ccC....', '.....wwcccC...', 'llll.ccccccC..', '...cccccccccC.', '..ccccccccccC.', 'lllccccccccccC',
    '...CCccccccCC.', '.....CCcccC...', '.lll...CCC....',
  ], { c: '#e9eef5', C: '#b9c2cc', w: '#ffffff', l: '#b9c2cc' }],
  '💧': ['fx-drop', 'Giọt nước', [
    '....bB....', '....bB....', '...bbbB...', '...bbbB...', '..bbbbbB..', '.bbwbbbbB.',
    'bbwbbbbbbB', 'bbwbbbbbbB', 'bbwbbbbbbB', 'BbbbbbbbbB', '.BbbbbbbB.', '..BBBBBB..',
  ], { b: '#7cb6e8', B: '#4f8fc9', w: '#e3f1fb' }],
  '🌀': ['fx-swirl', 'Xoáy', [
    '....BBBBB....', '..bB.....BB..', '.bB..bbbB..B.', '.B..bBBBBbB..', 'bB.bB....BB.B', 'bB.bB.bB..bB.',
    'bB.bB.BbB.bB.', 'bB.BB..bB.bB.', 'BB..BbbB..bB.', '.bB..BB..bB..', '.BBbB..bbBB..', '...BBbbBB....',
    '.....BB......',
  ], { b: '#7cb6e8', B: '#4f8fc9' }],
  '💬': ['talk-bubble', 'Trò chuyện', [
    '.cccccccccC.', 'cwwccccccccC', 'cwcccccccccC', 'cckkckkckkcC', 'cckkckkckkcC', 'CccccccccccC',
    '.CcccCCCCCC.', '..ccC.......', '..cC........', '..C.........',
  ], { c: '#fffaf3', C: '#dcc0a0', w: '#ffffff', k: '#9b6238' }],
  '🔔': ['alert-bell', 'Chuông báo', [
    '.....yY.....', '....yyyY....', '...ywyyyY...', '..ywyyyyyY..', '..ywyyyyyY..', '..yyyyyyyY..',
    '..yyyyyyyY..', '.yyyyyyyyyY.', 'yyyyyyyyyyyY', 'YYYYYYYYYYYY', '.....tt.....',
  ], { y: '#ffd75e', Y: '#e0a422', w: '#fff6c9', t: '#c8915f' }],
  '🚨': ['alert-siren', 'Báo động', [
    'a..........a', '.a...rR...a.', '...rrwrrR...', '..rrwrrrrR..', '..rwrrrrrR..', 'a.rrrrrrrR.a',
    '..rrrrrrrR..', '.gggggggggG.', 'gggggggggggG', 'GGGGGGGGGGGG',
  ], { r: '#e84a5f', R: '#b8384b', w: '#ffc2c8', g: '#b9c2cc', G: '#8a96a3', a: '#ffd75e' }],
  '📢': ['talk-loudspeaker', 'Loa công bố', [
    'lR..........', 'lrwR........', 'lrwwrR......', 'lrrrrrrcccC.', 'lrrrrrrcccC.', 'lrrrrrRCCcC.',
    'lrrrRR...C..', 'lrRR.....C..', 'lR......CC..',
  ], { r: '#e86f6f', R: '#c25555', w: '#ffb3b3', c: '#b9c2cc', C: '#8a96a3', l: '#fff3e3' }],
  '📣': ['talk-megaphone', 'Loa thông báo', [
    '..........yy', '.......rl...', '.....rwrl.y.', '...rwrrrl...', 'cccrrrrrl.yy', 'cccrrrrrl...',
    'CCCrrrrrl.y.', '...RRrrrl...', '.C...RRrl.yy', '.CC....Rl...',
  ], { r: '#e86f6f', R: '#c25555', w: '#ffb3b3', c: '#b9c2cc', C: '#8a96a3', l: '#fff3e3', y: '#f4c24f' }],
  '🔗': ['chain-link', 'Mắt xích', [
    '......lhhhhH.', '.....lhHHHHhH', '.....hH....hH', '.wggghH....hH', 'wgGGGhhG...hH', 'gG...HgghhhhH',
    'gG....ggHHHH.', 'gG....gG.....', 'GggggggG.....', '.GGGGGG......',
  ], { g: '#b9c2cc', G: '#8a96a3', w: '#e6ebf0', h: '#a7b2bd', H: '#7a8693', l: '#dfe5eb' }],
  '🚩': ['flag-red', 'Cờ đỏ', [
    'pPfffffF....', 'pPfwwfffffF.', 'pPfwfffffffF', 'pPfffffffffF', 'pPFFfffffFF.', 'pP..FFFFF...',
    'pP..........', 'pP..........', 'pP..........', 'pP..........', 'pP..........', 'pP..........',
  ], { f: '#e84a5f', F: '#b8384b', w: '#ff9aa5', p: '#c8915f', P: '#9b6238' }],
  '🏴': ['flag-black', 'Cờ đen', [
    'pPfffffF....', 'pPfwwfffffF.', 'pPfwfffffffF', 'pPfffffffffF', 'pPFFfffffFF.', 'pP..FFFFF...',
    'pP..........', 'pP..........', 'pP..........', 'pP..........', 'pP..........', 'pP..........',
  ], { f: '#4a4048', F: '#352d34', w: '#8a8090', p: '#c8915f', P: '#9b6238' }],
  '☯': ['sign-yin-yang', 'Âm dương', [
    '....cccc....', '..cccccccd..', '.cwccccccdd.', '.wcccddccdd.', 'cccccccccddd', 'ccccccccdddd',
    'ccccdddddddd', 'cccddddddddd', '.ccddccdddd.', '.Ccdddddddd.', '..Cddddddd..', '....dddd....',
  ], { c: '#fffaf3', C: '#e2c9a0', w: '#ffffff', d: '#5a4440' }],
  '☢': ['sign-radiation', 'Phóng xạ', [
    '....yyyy....', '..yykkkkyY..', '.yywkkkkyyY.', '.ywwkkkkyyY.', 'yyyyyyyyyyYY', 'yyyyykkyyyYY',
    'ykkkykkykkkY', 'ykkkyyyykkkY', '.ykkkyykkkY.', '.YykyyyYkYY.', '..YYYYYYYY..', '....YYYY....',
  ], { y: '#ffd75e', Y: '#e0a422', w: '#fff6c9', k: '#2e1d14' }],
  '🐾': ['paw-print', 'Dấu chân', [
    '...tT...tT...', '..twtT.twtT..', '..TttT.TttT..', 'tT.TT...TT.tT', 'wtT.......wtT', 'TtT..ppP..TtT',
    '.T..plppP..T.', '...plppppP...', '..ppppppppP..', '..PpppPpppP..', '...PPP.PPP...',
  ], { t: '#f4a3b4', T: '#d9708a', w: '#ffe1ea', p: '#c8915f', P: '#9b6238', l: '#e8c49a' }],
};
