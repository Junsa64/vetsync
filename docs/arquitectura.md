# Arquitectura de VetSync

## Decisión: monolito modular bien desacoplado

El caso permite microservicios o un monolito modular. Elegimos **monolito modular**
porque el dominio es pequeño (4 módulos) y el equipo es de una persona: los
microservicios agregarían red, despliegues independientes y consistencia eventual
sin un beneficio real hoy. A cambio, cada módulo se diseñó con sus propios puertos
para que extraerlo a un servicio sea mover una carpeta y cambiar un adaptador.

```mermaid
flowchart LR
  UI[Frontend React] -->|HTTP /api| HTTP[Capa HTTP Express]
  HTTP --> PAT[patients]
  HTTP --> VET[vets]
  HTTP --> APP[appointments]
  HTTP --> NOT[notifications]
  APP -. PetDirectory .-> PAT
  APP -. VetDirectory .-> VET
  APP == evento appointment.scheduled ==> BUS((EventBus))
  BUS ==> NOT
  NOT -. AppointmentFeed .-> APP
  NOT -. ContactDirectory .-> PAT
  NOT --> MAIL[EmailSender simulado]
```

Las flechas punteadas son **puertos** (interfaces definidas por el módulo que las usa)
y se conectan en la raíz de composición (`container.ts`). Ningún módulo importa las
clases internas de otro: solo su `public.ts`. Una prueba de arquitectura lo verifica.

## Modelo de datos (MySQL)

```mermaid
erDiagram
  OWNERS ||--o{ PETS : tiene
  PETS ||--o{ MEDICAL_RECORDS : historial
  VETS ||--o{ MEDICAL_RECORDS : registra
  PETS ||--o{ APPOINTMENTS : agenda
  VETS ||--o{ APPOINTMENTS : atiende
  APPOINTMENTS ||--o| SENT_REMINDERS : recordatorio

  OWNERS {
    char36 id PK
    varchar full_name
    varchar email UK
    varchar phone
  }
  PETS {
    char36 id PK
    char36 owner_id FK
    varchar name
    varchar species
    date birth_date
  }
  VETS {
    char36 id PK
    varchar full_name
    varchar email UK
    varchar specialty
  }
  MEDICAL_RECORDS {
    char36 id PK
    char36 pet_id FK
    char36 vet_id FK
    datetime recorded_at
    varchar diagnosis
  }
  APPOINTMENTS {
    char36 id PK
    char36 pet_id FK
    char36 vet_id FK
    datetime starts_at
    datetime ends_at
    enum modality
    enum status
    varchar meeting_url
  }
  SENT_REMINDERS {
    char36 appointment_id PK
    datetime sent_at
  }
  EMAIL_OUTBOX {
    char36 id PK
    varchar recipient
    varchar subject
    enum kind
  }
```

Script completo: [`schema.sql`](./schema.sql).

Decisiones clave del esquema:

- **UUID (`CHAR(36)`) como llave**: los IDs se generan en la aplicación (puerto `IdGenerator`), lo que permite crear la entidad completa antes de persistirla y facilita una futura separación en servicios sin colisiones de autoincrementales.
- **`ends_at` almacenado** (no solo duración): la consulta de choques `starts_at < :fin AND ends_at > :inicio` usa el índice compuesto `(vet_id, status, starts_at, ends_at)` sin calcular columnas.
- **Choques de horario**: MySQL no tiene restricciones de exclusión por rango, así que la regla vive en el caso de uso y se serializa por veterinario (mutex en memoria; `SELECT … FOR UPDATE` sobre la fila del veterinario en MySQL).
- **`sent_reminders` separado de `appointments`**: notificaciones no escribe en tablas de otro módulo.
- **Historial médico de solo inserción**: un diagnóstico no se edita, se agrega uno nuevo (trazabilidad clínica).

## Estructura de carpetas

```text
vetsync/
├── AGENTS.md                  # reglas para la IA (Fase 1.2)
├── .github/workflows/ci.yml   # lint + tests + cobertura ≥ 80 %
├── docs/                      # arquitectura, esquema, API, informe de tests, bitácora
├── backend/
│   ├── src/
│   │   ├── shared/            # kernel compartido: errores, Clock, IdGenerator, EventBus, KeyedMutex
│   │   ├── modules/
│   │   │   ├── patients/      # dueños, mascotas, historial médico
│   │   │   │   ├── domain/
│   │   │   │   ├── application/   # casos de uso + puertos
│   │   │   │   ├── infrastructure/ # repos en memoria, rutas HTTP
│   │   │   │   └── public.ts      # única puerta de entrada para otros módulos
│   │   │   ├── vets/
│   │   │   ├── appointments/
│   │   │   └── notifications/
│   │   ├── http/              # app Express, middleware de errores
│   │   ├── container.ts       # raíz de composición (único lugar con `new` de infraestructura)
│   │   ├── seed.ts            # datos de demostración
│   │   └── main.ts            # arranque del servidor y del programador de recordatorios
│   └── test/                  # espejo de src/, una carpeta por módulo
└── frontend/                  # React + Vite + TypeScript
```

### Justificación con SOLID y escalabilidad

| Decisión | Principio | Por qué |
|---|---|---|
| Un caso de uso por clase (`ScheduleAppointment`, `CancelAppointment`) | S | Cada clase cambia por una sola razón de negocio. |
| Modalidad de cita y canal de notificación detrás de puertos (`MeetingRoomProvider`, `EmailSender`) | O | Agregar WhatsApp o Zoom es una nueva clase, no editar el caso de uso. |
| Repositorios en memoria y MySQL comparten la misma interfaz | L | Las pruebas contra la versión en memoria valen para cualquier implementación. |
| `PetDirectory` solo expone `exists()`; `ContactDirectory` solo el contacto | I | Citas no ve el historial médico; notificaciones no ve diagnósticos. |
| Casos de uso reciben interfaces por constructor; `Clock` inyectado | D | Pruebas deterministas y la infraestructura se cambia sin tocar el dominio. |
| Comunicación entre módulos por eventos (`appointment.scheduled`) | Bajo acoplamiento | Citas no sabe que existe el módulo de correo. |
