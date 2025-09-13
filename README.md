# RubikApp — 3×3 Rubik's Cube (PWA)

RubikApp è una web‑app open‑source che emula un cubo di Rubik 3×3 in **HTML + CSS 3D + JavaScript**, installabile come **PWA** e utilizzabile **offline**.

- Rotazione vista: trascina con mouse o touch.
- Mosse tastiera: **U D L R F B**, aggiungi `’` per l'inversa e `2` per il doppio (es: `R U R' U'`).
- Scorciatoie: `S` scramble, `X` reset, `Z` undo, `Y` redo.
- Salvataggio: stato e vista sono salvati in `localStorage`. Export/Import JSON inclusi.
- UI: pulsantiera mosse + slider velocità animazione.

> Nota: per semplicità, l'animazione non ruota gli strati fisici come in un motore 3D completo, ma applica le permutazioni con una transizione leggera. L'obiettivo è essere *leggeri, offline e didattici*.

## Struttura
```
RubikApp/
 ├─ index.html
 ├─ style.css
 ├─ app.js
 ├─ manifest.json
 ├─ service-worker.js
 └─ icons/
     ├─ icon-192.png
     └─ icon-512.png
```

## Installazione (GitHub Pages)
1. Crea una repository pubblica chiamata **RubikApp**.
2. Carica i file della cartella (o lo ZIP allegato).
3. Attiva **Pages** (branch `main`, root).
4. Apri `https://<tuo-user>.github.io/RubikApp/`

## Roadmap (idee)
- Strati interattivi (drag per ruotare singole layer).
- Timer e contatore mosse.
- Supporto notazione completa (M, E, S, x y z).
- Layout colore personalizzabile e temi.
- Modalità “trainer” per PLL/OLL.

## Licenza
MIT — usa, modifica e condividi liberamente.
