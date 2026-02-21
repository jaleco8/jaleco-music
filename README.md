# Jaleco Music · Live Teleprompter

MVP mobile-first de teleprompter tipo karaoke con dos estados:

- `Preparación`: edición de texto, repetición, velocidad, volumen y ajustes de legibilidad.
- `Live`: lectura enfocada con auto-scroll, highlight animado, gestos y controles ocultables.

## Ejecutar

```bash
npm install
npm run dev
```

Build de producción:

```bash
npm run build
npm run preview
```

## Publicar en GitHub + GitHub Pages

El proyecto ya incluye despliegue automático con GitHub Actions en `.github/workflows/deploy-pages.yml`.

1. Crea un repositorio vacío en GitHub (sin `README` ni `.gitignore`).
2. En esta carpeta, ejecuta:

```bash
git init
git branch -M main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

3. En GitHub, abre `Settings -> Pages` y en `Build and deployment` selecciona `GitHub Actions`.
4. Cada push a `main` generará una nueva versión en GitHub Pages.
5. La URL final quedará como:

```text
https://TU_USUARIO.github.io/TU_REPO/
```

## Funciones implementadas

- Transición `Preparación -> Live` al presionar Play.
- Jerarquía visual de texto (`activa`, `previas`, `siguientes`).
- Highlight animado por línea con banda suave y progreso por cue.
- Auto-scroll suave con foco cercano al 40% del viewport.
- Estado `Explorando` al hacer scroll manual + botón `Volver a seguir`.
- Barra de progreso superior ultra delgada.
- Controles flotantes inferiores (Play/Pausa, chips de velocidad, repetición, volumen).
- Tap único para mostrar/ocultar controles y auto-hide en reproducción.
- Gestos:
  - doble tap izquierda: `-10s`
  - doble tap derecha: `+10s`
  - swipe horizontal: seek fino
  - swipe vertical: cambio de tamaño de texto
- Repeticiones rápidas: `x10`, `x20`, `x30`, `x40`, `∞`.
- Badge live con repetición activa y `Restan: N`.
- Microanimación de vuelta: `Repetición n/N`.
- Countdown opcional `3,2,1` y vibración opcional al cambiar de línea.
- Modo oscuro real, focus mode, safe areas y fullscreen.
- Audio opcional cargado por archivo local (`input type=file`).

## Stack

- React 19
- TypeScript
- Vite
