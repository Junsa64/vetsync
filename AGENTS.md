# AGENTS.md — Reglas para asistentes de IA en VetSync

Este archivo dicta las convenciones del proyecto a cualquier agente de IA
(Claude, Copilot, Cursor, Windsurf, Cline). Si una sugerencia de la IA viola
una regla, se rechaza aunque "funcione".

## 1. Lenguaje y compilación

- TypeScript en modo `strict` (backend y frontend).
- **Prohibido usar `any`** (explícito o implícito). Usa `unknown` y estrecha el tipo.
- Prohibido `@ts-ignore` y `@ts-expect-error` sin un comentario que justifique por qué.
- Módulos ES (`import`/`export`). Imports relativos con extensión `.js` en el backend (NodeNext).

## 2. Nombrado

- Variables, funciones y métodos: `camelCase` (`scheduleAppointment`, `startsAt`).
- Clases, interfaces y tipos: `PascalCase` (`AppointmentRepository`).
- Constantes de configuración: `UPPER_SNAKE_CASE`.
- Archivos: `camelCase.ts`; pruebas: `<archivo>.test.ts`.
- Las interfaces **no** llevan prefijo `I` (`Clock`, no `IClock`).
- Código en inglés; mensajes al usuario final en español.

## 3. Arquitectura (monolito modular desacoplado)

- Cada módulo vive en `backend/src/modules/<modulo>/` con tres capas:
  - `domain/`: entidades y reglas puras. No importa nada de infraestructura ni de Express.
  - `application/`: casos de uso y **puertos** (interfaces) que necesita.
  - `infrastructure/`: adaptadores (repositorios en memoria, rutas HTTP, correo simulado).
- Un módulo **solo** puede importar de otro módulo a través de su `public.ts`.
  Existe una prueba de arquitectura que falla si se rompe esta regla.
- La única pieza que conoce todas las implementaciones concretas es la raíz de
  composición `backend/src/main.ts` (`container.ts`).

## 4. SOLID (obligatorio)

- **S**: un caso de uso = una clase con un método público `execute`.
- **O**: nuevas modalidades o canales se agregan con nuevas implementaciones de un puerto, no con `if`/`switch` en el caso de uso.
- **L**: toda implementación de un puerto debe pasar las mismas pruebas que la versión en memoria.
- **I**: puertos pequeños y específicos (`PetDirectory.exists`), nunca "repositorio Dios".
- **D**: **uso obligatorio de interfaces**. Los casos de uso reciben sus dependencias por constructor
  tipadas con interfaces. Prohibido `new` de infraestructura dentro de `domain/` o `application/`.
- Prohibido `Date.now()` / `new Date()` sin argumentos en dominio o aplicación: usa el puerto `Clock`.

## 5. Manejo de errores

- Los errores de negocio extienden `DomainError` (`ValidationError`, `NotFoundError`, `ConflictError`) y llevan un `code` estable.
- **Todo manejador HTTP usa `try/catch`** y delega el error con `next(error)` al middleware central.
- El middleware central traduce `DomainError` a 400/404/409 y cualquier otro error a 500 **sin exponer el stack**.
- Prohibido tragarse errores (`catch {}` vacío). Si se ignora un error, se registra y se justifica.

## 6. TDD

- Ciclo rojo → verde → refactor. Primero se escribe la prueba que falla y se hace commit.
- Las pruebas usan el runner nativo `node:test` + `node:assert/strict`.
- Las pruebas de dominio/aplicación usan dobles en memoria y un `FixedClock`; nunca la hora real.
- Cobertura mínima de líneas: **80 %** (la CI falla por debajo).

## 7. Seguridad

- Nunca escribir secretos, llaves ni contraseñas en el código ni en prompts. Usar variables de entorno.
- Validar y normalizar toda entrada del usuario en el borde (DTO) antes de llegar al dominio.
- Límite de tamaño en el cuerpo JSON. Sin `eval`, sin construir SQL concatenando strings.

## 8. Qué debe hacer la IA antes de entregar código

1. Indicar qué prueba cubre el cambio (o escribirla primero).
2. Confirmar que `npm run lint` y `npm test` pasan.
3. Señalar explícitamente cualquier suposición que no pudo verificar.
