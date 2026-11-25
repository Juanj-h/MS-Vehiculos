# MS-Vehiculos

Node.js + TypeScript + Express + PostgreSQL (puerto 3002, base en 5433).

## Puesta en marcha
1. `docker compose up -d`
2. `npm install`
3. `npm run db:init`   (crea tablas y precarga tipos: CARRO, MOTOCICLETA, BICICLETA, OTRO)
4. `npm run dev`       (o F5 en VS Code)

Pruebas: `requests.http` (extensión REST Client). Las escrituras requieren el header `x-cuenta-id`
(administrador al gestionar vehículos; guarda al registrar eventos).
