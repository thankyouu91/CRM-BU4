Rig 2.0 golden images (petdex/test/rig2.test.js)
================================================

What they are
  Sprite sheets rendered by public/ta-tua/game/js/rig2 in Node, compared pixel-exactly by the test.
  Layout is the same as the approved pets-pilot sheets (phase1/pets-pilot/pal/*.png):
    pet-<id>-<stage>[-wear].png   8 rows (idle-S, idle-E, idle-N, idle-W, walk-S, walk-E, walk-N, walk-W) x 6 frames, 48x48 cells
    pet-<id>-adult-emotes.png     6 rows (wave, jump, sad, think, busy, spin), S view, 4 to 6 frames
    -wear = crown (head) + glasses (face) + scarf (neck). Feet pivot (24, 44) in every cell.

How they were made (2026-10-31)
  1. The JS port was checked frame by frame against the pilot reference renderer (pets-pilot/scripts/rig2.py):
     3104 frames (boba, meo_bac, canh_cut, tho_la; all 6 stages; idle and walk in 4 directions; 6 emotes;
     bare, all 3 items and each item alone): 0 pixels and 0 anchors different.
  2. The goldens were then written by the JS renderer (RIG2_UPDATE_GOLDEN=1) and compared with the pilot files:
     pet-boba-adult, pet-boba-adult-wear, pet-boba-baby, pet-boba-baby-wear, pet-boba-adult-emotes,
     pet-meo_bac-adult, pet-meo_bac-adult-wear, pet-meo_bac-adult-emotes: IDENTICAL to pal/*.png.

Intended differences from the pilot
  A. canh_cut (all three canh_cut files): the penguin uses the new 'navy' ramp instead of the pilot's 'fur_blue'.
     Director's fix: shared/pets.js gives canh_cut main #3d4a6b, a dark navy penguin, and the ramp must keep the
     species' hue AND value. Silhouette and every pose are unchanged (0 pixels change alpha); every fur pixel moves
     one step darker:  #2f6f9a -> #3d2a1f (shadow), #3f8fc0 -> #2f6f9a (mid), #58b9d6 -> #3f8fc0 (light),
     #8fd0e8 -> #58b9d6 (highlight). Line stays #2e1d14.
     Note: the locked 48-colour palette has no true navy; 'navy' = [#2e1d14, #3d2a1f, #2f6f9a, #3f8fc0, #58b9d6]
     is the darkest ramp that keeps a blue hue. A real navy (about #3d4a6b) needs a palette swap (style bible sect. 1:
     add a colour only by dropping one), which is the art director's call.
  B. Not in these goldens, but different from the pilot by design (the pilot never rendered these cases):
     - a jump (or squash) that would push a pixel onto the top row of the 48x48 cell is lowered until it fits
       (pilot: canh_cut wearing the crown and tho_la clipped at the jump apex);
     - LEVEL_FORMS growth (level 10+) is capped per species so the standing pet keeps 2 free rows on top;
     - elder marks (cane, brows, beard), level marks and quy/huyenthoai auras are drawn (pilot: none).

  C. The four -wear files (pet-boba-adult-wear, pet-boba-baby-wear, pet-meo_bac-adult-wear, pet-canh_cut-adult-wear) were
     regenerated on 2026-10-31 (branch claude/design-pets-wear) because crown, glasses and scarf are no longer the
     pilot's procedural drawings: every wearable is now the phase-2 artists' data (rig2/wear/data/*.js, built by
     scripts/art/build-wear.mjs from wear-<slot>/data/<id>.json). What changed, all by design:
     - crown: redrawn on an even 12 px width (10 px "small" on the baby), same seat on the head;
     - glasses: the wear-face stamp (S/E/N + "big" for the baby), placed on the eye boxes, outer-silhouette outline;
     - scarf: the wear-neck stamp (S/E/N + "small"), chin occlusion as before, E tail rows shift with pose.flutter;
     - Boba's cup (WEAR-SPEC D2): pet -> cup body -> scarf -> straw + cup paws -> glasses -> crown, so the scarf now
       shows over the cup lid while the straw stays on top;
     - baby N: the scarf's longer tail reached row 45 (below the feet); the renderer cuts neck/back/charm items at the
       ground row and re-outlines the cut, as for every item (2 px).
     Before regenerating, every item was compared pixel by pixel with the artists' own preview code (hw.py,
     common.py, neckprev.py, preview.py) on boba, meo_bac, canh_cut, tho_la x 6 stages x S/E/N/W: crown, glasses and
     scarf are identical apart from canh_cut's navy recolour (A) and the ground cut above.

Updating
  Only after looking at the new images next to the old ones (scripts/art/rig2-sheet.mjs, pet-lab.html):
    RIG2_UPDATE_GOLDEN=1 node --test petdex/test/rig2.test.js
  and add a line here saying what changed and why.
