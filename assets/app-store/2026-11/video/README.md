# Video o aplikaci VYS (25. 11. 2026)

`VYS-aplikace-video-v5-bez-hudby.mp4` — 29,5 s, 1080 × 1920, 30 fps. Čtyři role (rodič, dítě, trenér, koordinátor),
tři záběry s kocourem z Higgsfieldu (úvod, pípnutí kartičky, závěr), texty, hudba.

- `video.html` — celá animace; čas se nastavuje funkcí `setTime(t)`, nic neběží samo.
- `render.mjs` — Playwright vyfotí 885 snímků do `frames/` (4 okna, ~15 s).
- `music.py` — hudba je syntetizovaná (numpy + scipy), údery sedí na střihy; `events.json` = zvuky střihu.
- `config.json` — které úseky záběrů z Higgsfieldu se použijí (posun, rychlost, okamžik pípnutí).
- Složení: `ffmpeg -framerate 30 -i frames/f_%05d.jpg -i music.wav -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -t 29.5 out.mp4`

Podklady (obrazovky aplikace s vymyšlenými daty 1290 × 2796, původní záběry z Higgsfieldu a skripty na focení)
nejsou v repu kvůli velikosti: `~/Downloads/VYS-aplikace-video-podklady/`. `video.html` je čeká v `../out/store878/` (focené ve výšce 878 bodů, aby s lištou hodin daly přesný poměr stran iPhonu)
a záběry převedené na H.264 po jednom snímku (`-g 1`) v `clips/clipA|B|C.mp4`.

Pro App Store (náhled aplikace) je potřeba jiný formát: 886 × 1920 a nejvýš 30 s — tohle video je 1080 × 1920.

## Verze 3 (25. 11. večer)
- Z telefonu „vyskakují" zvětšené výřezy obrazovky (`CALLOUTS` ve `video.html`: čas, obrazovka, výřez v bodech, cílová šířka a výška).
- Každá role přichází jinak (zdola, shora, z boku, přiblížením), na střizích světelný pruh, v pozadí prach.
- Závěr: vějíř čtyř telefonů „Čtyři role. Jedna aplikace.", pak kocour jen v úseku se zavřenou pusou (od 2,95 s původního
  záběru; dopočítané mezisnímky `minterpolate`, protože běží 1:1).
- `VYS-aplikace-video-v3-bez-hudby.mp4` = stejný obraz bez zvuku, pro Instagram (hudba se přidá až tam).

## Verze 4 (25. 11.) — střih na skladbu
- David dodal skladbu „Aura Farming" (Mustafa Saboori). Je to komerční nahrávka, proto **v repu není** a verze s ní
  leží jen v `~/Downloads/VYS-aplikace-video-v4-aura-farming.mp4`. V repu je obraz bez zvuku.
- Použitý úsek: 39,863 s → 72,28 s (32,42 s). Tempo 110,52 BPM, basy nastoupí v 43,36 s = první záběr rodiče,
  hlasitá část končí v 68,5 s, poslední úder v 69,61 s = kocour v závěru. Všechny střihy jsou v `config.json`
  (`S`, `cuts`, `grid`) a sedí na doby; na každou dobu pozadí a telefon lehce „dýchnou".
- Zvětšené výřezy z telefonu jsou vypnuté (`CALLOUTS = []`) — Davidovi se nelíbily. Místo nich se telefon při výměně
  obrazovky střídavě posouvá a otáčí kolem osy (`SPIN`).
- Zvuk: `ffmpeg -ss 39.863 -t 32.42 -i skladba.mp3 -af "afade=t=in:d=0.12,afade=t=out:st=31.5:d=0.92"`; render `node render.mjs 0 32.42`.

## Verze 5 (25. 11.) — 3D telefon, skutečné hraní, karta po pípnutí
- **Telefon má tloušťku:** přední sklo + 26 vrstev boku (`.edge`, `translateZ`) + záda s foťákem (`.back`). Na `#phone` nesmí být
  `opacity` ani `filter` — prohlížeč by ho zploštil. Výměna obrazovky = otočka o 360° (uprostřed jsou vidět záda).
- **Skutečné hraní:** `rec2.mjs` zpomalí čas v běžící appce (rAF, `performance.now`, `setTimeout`) 3× a fotí snímek za snímkem
  v 860 × 1756; `mkclip.py` z toho udělá úsek s pevnými 30 fps. Úseky jsou v tabulce `FOOT` (souboj, cesta, bedny, triky).
  CDP screencast ani Playwright video nestačí — dávají jen 430 px na šířku.
- **Rodič:** při příchodu oznámení kamera najede na horní část telefonu (`zoomN`).
- **Pípnutí:** scéna má 8 dob; po pípnutí vyjede karta (`#tapCard`): 7. vstup se odškrtne, „zbývá 9 → 8", klubíčka 50 → 60.
  Čísla na kartě jsou ilustrační.
- Záběry s kocourem běží z verzí dopočítaných na 60 fps (`clipB60`, `clipC60`), aby šly pouštět pomaleji bez trhání.
