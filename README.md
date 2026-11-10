# T-REX: La Hora del Almuerzo (demo)

Juego de acción en 3ra persona: eres un T-Rex en un parque de dinosaurios de los años 90 y tienes que
"almorzarte" a la presa de cada escena antes de que termine la cuenta regresiva, mientras los
velociraptors te atacan por los flancos. Todo se ve como una cinta VHS vieja.

## Cómo jugar (Mac, Windows o Linux)

1. Descarga el repo y haz **doble clic en `index.html`** (Safari, Chrome o Firefox).
2. Necesita internet la primera vez (carga Three.js desde un CDN).

| Tecla | Acción |
|---|---|
| W A S D | Correr (el T-Rex corre por defecto) |
| Shift (mantener) | Caminar con sigilo: la presa te oye mucho menos |
| Clic / Espacio | Morder |
| E (o clic derecho) | Rugir: paraliza a los humanos un instante y espanta a los raptors |
| Q | Olfatear: muestra dónde está la presa |
| Mouse / ← → | Cámara (clic en la pantalla para capturar el mouse) |
| Esc | Pausa |

## Qué incluye la demo

- **Escena 1 – El centro de visitantes (atardecer):** 1 raptor, 100 s.
- **Escena 2 – El recinto (tormenta nocturna):** 3 raptors, lluvia y relámpagos, 90 s.
- La presa te escucha cuando corres (el suelo tiembla); caminando con Shift te puedes acercar sin que te note, escapa y se esconde detrás del jeep,
  el galpón, troncos o arbustos. Si te acercas, sale corriendo otra vez y se cansa.
- Los raptors rodean al T-Rex y atacan con saltos; una mordida los elimina (y te cura un poco).

## Técnica

- Un solo archivo (`index.html`), Three.js r160, sin assets externos: modelos, texturas y sonidos
  son procedurales.
- Los dinosaurios tienen una piel continua que se recalcula cada cuadro sobre el esqueleto animado
  (cráneo esculpido, muslos musculosos, relieve de escamas). El follaje usa texturas con transparencia
  (sombras moteadas), con viento, y el cielo se refleja en la piel.
- Se renderiza a ~420 líneas de resolución interna y luego pasa por un shader VHS (sangrado de croma,
  jitter de líneas, banda de tracking, ruido de cabezal, scanlines, viñeta). Por eso es liviano.
- Para agregar escenas, suma entradas al array `LEVELS` (semilla del terreno, tiempo, raptors,
  noche/lluvia y la presa).
