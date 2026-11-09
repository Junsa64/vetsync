# API de VetSync

Base: `http://localhost:3000/api` · Formato: JSON · Fechas: ISO 8601 en UTC (`2026-11-11T16:00:00.000Z`).

## Errores

Todas las respuestas de error tienen la misma forma:

```json
{ "error": { "code": "VET_BUSY", "message": "El veterinario ya tiene una cita en ese horario." } }
```

| HTTP | Cuándo | Códigos |
|---|---|---|
| 400 | Entrada inválida | `REQUIRED_FIELD`, `FIELD_TOO_LONG`, `INVALID_EMAIL`, `INVALID_DATE`, `INVALID_NUMBER`, `INVALID_OPTION`, `INVALID_BODY`, `INVALID_JSON`, `INVALID_DURATION`, `APPOINTMENT_IN_PAST`, `INVALID_BIRTH_DATE`, `RECORD_IN_FUTURE` |
| 404 | Recurso inexistente | `PET_NOT_FOUND`, `VET_NOT_FOUND`, `OWNER_NOT_FOUND`, `APPOINTMENT_NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 409 | Conflicto de negocio | `VET_BUSY`, `PET_BUSY`, `OWNER_EMAIL_TAKEN`, `VET_EMAIL_TAKEN`, `APPOINTMENT_NOT_ACTIVE` |
| 413 | Cuerpo > 100 kB | `PAYLOAD_TOO_LARGE` |
| 500 | Error inesperado (sin detalles internos) | `INTERNAL_ERROR` |

## Salud

`GET /health` → `200 { "status": "ok", "time": "…" }`

## Dueños

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/owners` | — | `200 Owner[]` (orden alfabético) |
| POST | `/owners` | `{ fullName*, email*, phone? }` | `201 Owner` · `409 OWNER_EMAIL_TAKEN` |

`Owner = { id, fullName, email, phone, createdAt }`. El correo se guarda en minúsculas.

## Mascotas e historial médico

| Método | Ruta | Cuerpo / query | Respuesta |
|---|---|---|---|
| GET | `/pets?ownerId=` | `ownerId` opcional | `200 Pet[]` |
| POST | `/pets` | `{ ownerId*, name*, species*, breed?, birthDate? }` | `201 Pet` · `404 OWNER_NOT_FOUND` · `400 INVALID_BIRTH_DATE` |
| GET | `/pets/:petId` | — | `200 { pet, owner, history: MedicalRecord[] }` (historial del más reciente al más antiguo) |
| POST | `/pets/:petId/medical-records` | `{ diagnosis*, treatment?, notes?, vetId?, recordedAt? }` | `201 MedicalRecord` · `400 RECORD_IN_FUTURE` |

Los registros médicos son de solo inserción: una corrección se registra como un nuevo registro.

## Veterinarios

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/vets` | — | `200 Vet[]` |
| POST | `/vets` | `{ fullName*, email*, specialty* }` | `201 Vet` · `409 VET_EMAIL_TAKEN` |

## Citas

| Método | Ruta | Cuerpo / query | Respuesta |
|---|---|---|---|
| GET | `/appointments?vetId=&petId=&from=&to=` | todos opcionales; `from` incluyente, `to` excluyente (por hora de inicio) | `200 Appointment[]` ordenadas por inicio |
| POST | `/appointments` | ver abajo | `201 Appointment` |
| PATCH | `/appointments/:id/cancel` | — | `200 Appointment` (status `CANCELLED`) · `409 APPOINTMENT_NOT_ACTIVE` |

**Agendar** (`POST /appointments`):

```json
{
  "petId": "…",
  "vetId": "…",
  "startsAt": "2026-11-11T16:00:00.000Z",
  "durationMinutes": 30,
  "modality": "TELEMEDICINE",
  "reason": "Seguimiento de dermatitis"
}
```

Reglas, en este orden:

1. `durationMinutes` entre 15 y 120, múltiplo de 15 → si no, `400 INVALID_DURATION`.
2. `startsAt` posterior al momento actual → si no, `400 APPOINTMENT_IN_PAST`.
3. La mascota y el veterinario existen → `404 PET_NOT_FOUND` / `404 VET_NOT_FOUND`.
4. El veterinario no tiene otra cita activa que se traslape `[inicio, fin)` → `409 VET_BUSY`.
   Una cita que termina 16:30 **no** choca con otra que empieza 16:30.
5. La mascota no tiene otra cita activa que se traslape → `409 PET_BUSY`.
6. Los pasos 4–5 y el guardado son atómicos por veterinario y mascota: dos solicitudes simultáneas no pueden ocupar el mismo horario.
7. Si es `TELEMEDICINE`, la respuesta incluye `meetingUrl` (sala simulada).
8. Se publica el evento `appointment.scheduled` → el módulo de notificaciones envía la confirmación por correo (simulado).

`Appointment = { id, petId, vetId, startsAt, endsAt, modality, reason, status, meetingUrl, createdAt }`

## Notificaciones (correo simulado)

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/notifications/outbox` | `200 SentEmail[]` del más nuevo al más viejo (máx. 500 en memoria) |
| POST | `/notifications/reminders/run` | `200 { sent, skipped, failed }` |

El servidor ejecuta el barrido de recordatorios automáticamente cada `REMINDER_INTERVAL_MS` (60 s por defecto).
Cada cita programada que empieza dentro de `REMINDER_LEAD_MINUTES` (24 h por defecto) recibe **un** recordatorio:
si el envío falla, se reporta y se reintenta en la siguiente corrida.

`SentEmail = { id, to, subject, body, kind: "CONFIRMATION" | "REMINDER", appointmentId, sentAt }`

## Ejemplos con curl

```bash
# Agendar
curl -X POST localhost:3000/api/appointments -H 'Content-Type: application/json' \
  -d '{"petId":"<id>","vetId":"<id>","startsAt":"2026-11-11T16:00:00Z","durationMinutes":30,"modality":"IN_PERSON","reason":"Vacuna"}'

# Ver la agenda de un veterinario para un día
curl 'localhost:3000/api/appointments?vetId=<id>&from=2026-11-11T07:00:00Z&to=2026-11-12T07:00:00Z'

# Forzar el envío de recordatorios
curl -X POST localhost:3000/api/notifications/reminders/run
```
