# Video o aplikaci VYS (25. 11. 2026)

`VYS-aplikace-video-v2.mp4` — 29,5 s, 1080 × 1920, 30 fps. Čtyři role (rodič, dítě, trenér, koordinátor),
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
