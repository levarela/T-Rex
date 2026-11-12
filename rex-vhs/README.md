# Hora de Almorzar (demo)

Juego de acción en tercera persona: manejás un T-rex que tiene que almorzarse a su presa
antes de que se acabe la cinta. Todo se ve como una grabación VHS de 1993.

Es independiente del juego que está en la raíz del repo: vive entero en esta carpeta.

## Cómo jugar (Mac, Windows o Linux)

Abrí `index.html` con doble clic. Funciona en Safari, Chrome y Firefox; no necesita
servidor ni instalar nada (la tipografía del OSD se baja de Google Fonts si hay internet;
sin internet usa Menlo).

| Tecla | Acción |
| --- | --- |
| `W A S D` o flechas | caminar y girar |
| `Shift` | correr (gasta aguante) |
| `Espacio` o clic | morder |
| `R` | rugir: saca a la presa de su escondite, la tumba si está cansada y espanta raptores |
| `P` / `M` / `F` | pausa / silencio / pantalla completa |

## Qué trae la demo

- **Escena 01, "El cerco roto"**: un claro de selva de noche, con lluvia, tormenta,
  la cerca eléctrica rota, el camino de servicio, dos vehículos del tour y una caseta.
- **La presa** corre, se esconde detrás de árboles, rocas y vehículos, y esquiva los
  mordiscos mientras está fresca. Hay que cansarla, tumbarla con un rugido y morder.
- **Enemigos**: el reloj (90 s) y dos raptores que aparecen a los 16 s y atacan por los flancos.
- **Olfato**: la flecha de abajo apunta siempre hacia la presa.

## Cómo está hecho

- [three.js](https://threejs.org) y nada más. Sin modelos ni texturas externas: el T-rex,
  los raptores, la presa, la selva y las texturas se generan por código, y el sonido se
  sintetiza con WebAudio.
- El T-rex es un cuerpo "lofteado" que se deforma cada frame (cola, cuello, respiración),
  con patas por cinemática inversa y mandíbula articulada (`src/dino.js`).
- Aspecto VHS (`src/vhs.js`): la escena se renderiza a 640×480 y pasa por un shader con
  sangrado de croma, jitter de línea, banda de tracking, nieve, dropouts y scanlines.
  Renderizar a baja resolución es además lo que lo hace liviano.

```
src/main.js      bucle del juego, controles, cámara, raptores, HUD
src/dino.js      modelo y animación procedural de los dinosaurios
src/human.js     la presa y su IA (huir, esconderse, esquivar)
src/world.js     escenario, luces, lluvia, tormenta
src/vhs.js       post-proceso VHS
src/audio.js     efectos de sonido sintetizados
src/textures.js  texturas procedurales
```

## Desarrollo

```bash
npm install
npm run build   # regenera index.html (un solo archivo autocontenido)
```

## Próximos pasos

- Más escenas: cada presa almorzada abre un escenario nuevo.
- Más presas por escena, con comportamientos distintos (el que se queda quieto, el que se sube al vehículo).
- Otros reptiles como enemigos y raptores en manada más listos.

Los personajes y escenarios son originales: es un homenaje al cine de dinosaurios de los 90,
sin nombres, logos ni personajes de ninguna película.
