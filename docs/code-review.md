# Code review automatizado (Fase III.1)

**Prompt usado** (el sugerido por la metodología, aplicado sobre `backend/src`):

> Actúa como un experto en Ciberseguridad y Rendimiento. Revisa el siguiente código en busca de:
> 1) Vulnerabilidades (SQLi, XSS), 2) Fugas de memoria, 3) Queries ineficientes (N+1).
> Sé crítico y sugiere correcciones.

Cada hallazgo se verificó con una prueba antes de aceptarlo. Los que no se pudieron
demostrar se marcan como riesgo aceptado, no como corregidos.

## Hallazgos corregidos

| # | Severidad | Hallazgo | Evidencia | Corrección | Prueba |
|---|---|---|---|---|---|
| 1 | **Alta** | **Condición de carrera "revisar y luego guardar"** en `ScheduleAppointment`: la revisión de choques y el `save` están separados por `await`, así que dos solicitudes simultáneas por el mismo horario pasan la revisión y **ambas se guardan**. Rompe directamente el requerimiento 2. | La prueba nueva falló con `actual: 2, expected: 1` (ver `evidencia/06-carrera-rojo.txt`). | `KeyedMutex` por llave `vet:<id>` y `pet:<id>`, adquiridas en orden fijo para evitar interbloqueos. En MySQL: transacción + `SELECT … FOR UPDATE` sobre la fila del veterinario (documentado en `schema.sql`). | `concurrency.test.ts`, `shared.test.ts` |
| 2 | Media | **N+1 en recordatorios**: por cada cita se consultaba contacto del dueño y nombre del veterinario. Con 200 citas del mismo veterinario son 400 consultas. | Revisión del ciclo en `SendAppointmentReminders.execute`. | Caché por corrida (`memo`) de contactos y nombres. | "no hace consultas N+1" (cuenta 1 consulta para 3 citas) |
| 3 | Media | **Crecimiento sin límite en memoria**: la bandeja del correo simulado guardaba todos los mensajes para siempre en un servidor de larga vida. | Revisión de `SimulatedEmailSender`. | Tope configurable (`maxStored`, 500 por defecto). | "la bandeja simulada no crece sin límite" |
| 4 | Baja | `KeyedMutex` podía dejar llaves retenidas en su mapa interno. | Diseño inicial del mutex. | Limpieza al liberar si nadie más espera; contador `pendingKeys`. | `pendingKeys === 0` tras las pruebas |

## Revisados sin hallazgo

- **SQL injection**: no hay SQL en tiempo de ejecución (repositorios en memoria). El esquema y la consulta de choques documentados usan parámetros (`?`), nunca concatenación. Regla en `AGENTS.md §7`.
- **XSS**: React escapa todo el texto renderizado; no se usa `dangerouslySetInnerHTML`. El único `href` dinámico (`meetingUrl`) lo genera el servidor, no lo escribe el usuario. Los correos son texto plano.
- **Validación de entrada**: todo cuerpo pasa por un parser de DTO (`asRecord`, `requireText` con longitud máxima, `requireEmail`, `requireOneOf`). El JSON tiene límite de 100 kB (413 si se excede).
- **Fuga de información**: el middleware de errores responde 500 genérico sin stack ni mensaje interno (prueba "un error inesperado responde 500 genérico").
- **ReDoS**: la regex de correo solo se evalúa después de limitar la entrada a 160 caracteres.
- `x-powered-by` deshabilitado.

## Riesgos aceptados (fuera del alcance de la práctica)

- **Sin autenticación ni autorización**: cualquiera con acceso a la API puede leer historiales médicos. Para producción: login de veterinarios y dueños con roles.
- **Sin rate limiting ni cabeceras de seguridad** (`helmet`).
- **Persistencia en memoria**: los datos se pierden al reiniciar. El adaptador MySQL no se implementó a propósito: no había forma de probarlo en esta entrega y código sin probar es deuda técnica. La interfaz y el esquema ya están listos para él.
- **Mutex en proceso**: protege una sola instancia del servidor. Con varias réplicas, la exclusión debe vivir en la base de datos (`FOR UPDATE`).

## Sugerencias de la revisión que se rechazaron

- *"Usar un ORM para prevenir SQLi"*: no aplica, no hay SQL ejecutándose; agregar un ORM sería una dependencia sin uso.
- *"Validar con una librería de esquemas (zod)"*: válido, pero los validadores propios ya cubren los casos con pruebas y evitan una dependencia más para cuatro DTOs.
