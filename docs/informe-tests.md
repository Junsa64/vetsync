# Informe de pruebas (Fase II.2)

**Runner:** `node:test` + `node:assert/strict` (nativo de Node 22, sin dependencias), ejecutado con `tsx`.
**Comando:** `cd backend && npm run test:coverage`

## Resultado final

| Métrica | Valor | Umbral CI |
|---|---|---|
| Pruebas | **59 aprobadas / 0 fallidas** (19 suites) | 0 fallidas |
| Cobertura de líneas | **99.37 %** | ≥ 80 % |
| Cobertura de ramas | **94.97 %** | ≥ 70 % |
| Cobertura de funciones | **98.89 %** | ≥ 80 % |

Salidas completas en [`evidencia/`](./evidencia): `08-suite-final.txt` y `05-cobertura.txt`.
(`src/main.ts` se excluye de la cobertura: solo arranca el servidor; `container.ts`, `seed.ts` y la app HTTP sí se miden.)

## Historia del ciclo TDD

| Paso | Commit | Estado | Evidencia |
|---|---|---|---|
| 1. Pruebas de `agendarCita` escritas antes del código | `test(appointments): pruebas fallidas…` | 🔴 0 / 12 | `01-tdd-rojo.txt` |
| 2. Implementación mínima | `feat(appointments): implementación…` | 🟢 12 / 12 | `02-tdd-verde.txt` |
| 3. Pruebas de notificaciones antes del módulo | `test(notifications): pruebas fallidas…` | 🔴 módulo inexistente | `03-notificaciones-rojo.txt` |
| 4. Módulo de notificaciones | `feat(notifications): …` | 🟢 41 / 41 | `04-notificaciones-verde.txt` |
| 5. Refactor SOLID (OCP, métodos extraídos) | `refactor(appointments): …` | 🟢 45 / 45, sin cambiar pruebas de negocio | — |
| 6. Prueba de concurrencia (hallazgo del code review) | — | 🔴 se agendaron **2** citas en el mismo horario | `06-carrera-rojo.txt` |
| 7. `KeyedMutex` + reserva atómica | `fix(security,perf): …` | 🟢 59 / 59 | `07-carrera-verde.txt` |

## Los 5 casos pedidos por la metodología para `agendarCita`

| Caso | Prueba | Resultado esperado |
|---|---|---|
| Cita válida | `agenda una cita válida y calcula la hora de fin` | `SCHEDULED`, `endsAt = startsAt + duración` |
| Veterinario ocupado | `rechaza la cita si el veterinario ya está ocupado` | `ConflictError VET_BUSY` (HTTP 409) |
| Fecha en el pasado | `rechaza una cita con fecha en el pasado` | `ValidationError APPOINTMENT_IN_PAST` (400) |
| Mascota no registrada | `rechaza una cita para una mascota no registrada` | `NotFoundError PET_NOT_FOUND` (404) |
| Veterinario inexistente | `rechaza una cita con un veterinario inexistente` | `NotFoundError VET_NOT_FOUND` (404) |

Casos de borde adicionales: citas contiguas permitidas (intervalos semiabiertos), cita envolvente, otro
veterinario a la misma hora, misma mascota con dos veterinarios (`PET_BUSY`), duración inválida, enlace de
telemedicina, publicación del evento y **dos solicitudes simultáneas**.

## Cobertura por requerimiento de negocio

| Requerimiento | Suites |
|---|---|
| 1. Registro de mascotas y dueños con historial médico | Registro de dueños · Registro de mascotas · Historial médico · API pública de pacientes |
| 2. Agendamiento sin choques de horario | agendarCita · bajo concurrencia · Cancelación y consultas · DTO de agendamiento |
| 3. Notificaciones simuladas por correo | Recordatorios · Rendimiento de recordatorios · Confirmación · Infraestructura de notificaciones |
| 4. Restricción técnica (modular, TDD, SOLID) | Arquitectura del monolito modular (límites, dominio puro, sin `any`, `Clock` inyectado) |
| Capa HTTP | API HTTP (integración) · Middleware de errores · Datos de demostración |

## Lo que no está probado (honestamente)

- **ESLint** no se pudo ejecutar en el entorno donde se generó el código (sin red para instalar paquetes); sus reglas
  más sensibles se aproximaron con `tsc --verbatimModuleSyntax` y búsquedas. La CI lo corre en cada push.
- La capa HTTP se probó localmente con un *shim* de Express (fuera del repositorio); la CI usa Express real.
- El frontend se verificó compilándolo con esbuild y recorriéndolo en Chromium headless contra la API (capturas en
  [`capturas/`](./capturas)); no tiene pruebas unitarias propias.
