-- VetSync — Esquema relacional propuesto (MySQL 8.0.16+)
-- Fase 1: diseño de arquitectura. La versión actual del backend usa
-- repositorios en memoria detrás de interfaces; este esquema es el contrato
-- para el adaptador MySQL (se conecta sin tocar dominio ni casos de uso).

CREATE DATABASE IF NOT EXISTS vetsync
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE vetsync;

-- ── Módulo vets ─────────────────────────────────────────────────
CREATE TABLE vets (
  id          CHAR(36)     NOT NULL,
  full_name   VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL,
  specialty   VARCHAR(80)  NOT NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_vets_email (email)
) ENGINE=InnoDB;

-- ── Módulo patients ─────────────────────────────────────────────
CREATE TABLE owners (
  id          CHAR(36)     NOT NULL,
  full_name   VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL,
  phone       VARCHAR(30)  NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_owners_email (email)
) ENGINE=InnoDB;

CREATE TABLE pets (
  id          CHAR(36)     NOT NULL,
  owner_id    CHAR(36)     NOT NULL,
  name        VARCHAR(80)  NOT NULL,
  species     VARCHAR(40)  NOT NULL,
  breed       VARCHAR(80)  NULL,
  birth_date  DATE         NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_pets_owner (owner_id),
  CONSTRAINT fk_pets_owner FOREIGN KEY (owner_id)
    REFERENCES owners (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Historial médico: registros inmutables (solo INSERT), ordenados por fecha.
CREATE TABLE medical_records (
  id           CHAR(36)     NOT NULL,
  pet_id       CHAR(36)     NOT NULL,
  vet_id       CHAR(36)     NULL,
  recorded_at  DATETIME(3)  NOT NULL,
  diagnosis    VARCHAR(255) NOT NULL,
  treatment    TEXT         NULL,
  notes        TEXT         NULL,
  PRIMARY KEY (id),
  KEY idx_medrec_pet_date (pet_id, recorded_at),
  CONSTRAINT fk_medrec_pet FOREIGN KEY (pet_id)
    REFERENCES pets (id) ON DELETE CASCADE,
  CONSTRAINT fk_medrec_vet FOREIGN KEY (vet_id)
    REFERENCES vets (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Módulo appointments ─────────────────────────────────────────
CREATE TABLE appointments (
  id           CHAR(36)     NOT NULL,
  pet_id       CHAR(36)     NOT NULL,
  vet_id       CHAR(36)     NOT NULL,
  starts_at    DATETIME(3)  NOT NULL,
  ends_at      DATETIME(3)  NOT NULL,
  modality     ENUM('IN_PERSON','TELEMEDICINE') NOT NULL,
  status       ENUM('SCHEDULED','CANCELLED','COMPLETED') NOT NULL DEFAULT 'SCHEDULED',
  reason       VARCHAR(255) NOT NULL,
  meeting_url  VARCHAR(255) NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- Búsqueda de choques: citas activas de un veterinario que se traslapan.
  KEY idx_appt_vet_overlap (vet_id, status, starts_at, ends_at),
  KEY idx_appt_pet_overlap (pet_id, status, starts_at, ends_at),
  -- Barrido de recordatorios: citas programadas que empiezan pronto.
  KEY idx_appt_status_start (status, starts_at),
  CONSTRAINT fk_appt_pet FOREIGN KEY (pet_id) REFERENCES pets (id),
  CONSTRAINT fk_appt_vet FOREIGN KEY (vet_id) REFERENCES vets (id),
  CONSTRAINT chk_appt_range CHECK (ends_at > starts_at),
  CONSTRAINT chk_appt_meeting CHECK (
    modality = 'IN_PERSON' OR meeting_url IS NOT NULL
  )
) ENGINE=InnoDB;

-- MySQL no tiene restricciones de exclusión por rango (como EXCLUDE de
-- PostgreSQL). El choque de horarios se evita en el caso de uso, dentro de
-- una transacción que bloquea la fila del veterinario:
--
--   START TRANSACTION;
--   SELECT id FROM vets WHERE id = ? FOR UPDATE;          -- serializa por vet
--   SELECT 1 FROM appointments
--    WHERE vet_id = ? AND status = 'SCHEDULED'
--      AND starts_at < ? AND ends_at > ?                  -- (nuevoFin, nuevoInicio)
--    LIMIT 1;
--   INSERT INTO appointments (...) VALUES (...);          -- solo si no hubo fila
--   COMMIT;

-- ── Módulo notifications ────────────────────────────────────────
-- El módulo de notificaciones guarda su propio registro de recordatorios
-- enviados: no modifica la tabla de citas (bajo acoplamiento).
CREATE TABLE sent_reminders (
  appointment_id  CHAR(36)    NOT NULL,
  sent_at         DATETIME(3) NOT NULL,
  PRIMARY KEY (appointment_id),
  CONSTRAINT fk_reminder_appt FOREIGN KEY (appointment_id)
    REFERENCES appointments (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bandeja de salida del correo simulado.
CREATE TABLE email_outbox (
  id              CHAR(36)     NOT NULL,
  recipient       VARCHAR(160) NOT NULL,
  subject         VARCHAR(200) NOT NULL,
  body            TEXT         NOT NULL,
  kind            ENUM('CONFIRMATION','REMINDER') NOT NULL,
  appointment_id  CHAR(36)     NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_outbox_created (created_at)
) ENGINE=InnoDB;
