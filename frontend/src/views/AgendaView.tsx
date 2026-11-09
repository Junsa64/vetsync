import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { Directory } from '../App';
import { dayRange, formatDay, formatTime, nextQuarter, toDateInput, toDateTimeInput } from '../format';
import type { Appointment, Modality } from '../types';

const DURATIONS = [15, 30, 45, 60, 90, 120];

interface Notice {
  kind: 'ok' | 'error';
  text: string;
}

export function AgendaView({ directory }: { directory: Directory }) {
  const [day, setDay] = useState(() => toDateInput(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);

  const [petId, setPetId] = useState('');
  const [vetId, setVetId] = useState('');
  const [startsAt, setStartsAt] = useState(() => toDateTimeInput(nextQuarter(new Date(Date.now() + 3_600_000))));
  const [duration, setDuration] = useState(30);
  const [modality, setModality] = useState<Modality>('IN_PERSON');
  const [reason, setReason] = useState('');

  const loadDay = useCallback(async () => {
    try {
      const { from, to } = dayRange(day);
      setAppointments(await api.listAppointments(from, to));
    } catch (error: unknown) {
      setNotice({ kind: 'error', text: error instanceof ApiError ? error.message : 'No se pudo cargar la agenda.' });
    }
  }, [day]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  const petById = useMemo(() => new Map(directory.pets.map((p) => [p.id, p])), [directory.pets]);
  const ownerById = useMemo(() => new Map(directory.owners.map((o) => [o.id, o])), [directory.owners]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const created = await api.scheduleAppointment({
        petId,
        vetId,
        startsAt: new Date(startsAt).toISOString(),
        durationMinutes: duration,
        modality,
        reason,
      });
      setNotice({
        kind: 'ok',
        // formatTime ya termina en "p.m."/"a.m.": no agregar otro punto después.
        text: `Cita agendada a las ${formatTime(created.startsAt)} — se envió la confirmación por correo (simulado)`,
      });
      setReason('');
      setDay(toDateInput(new Date(created.startsAt)));
      await loadDay();
    } catch (error: unknown) {
      setNotice({ kind: 'error', text: error instanceof ApiError ? error.message : 'No se pudo agendar la cita.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      await api.cancelAppointment(id);
      setNotice({ kind: 'ok', text: 'Cita cancelada: el horario quedó libre.' });
      await loadDay();
    } catch (error: unknown) {
      setNotice({ kind: 'error', text: error instanceof ApiError ? error.message : 'No se pudo cancelar.' });
    }
  }

  const { from } = dayRange(day);

  return (
    <div className="agenda">
      <section className="panel schedule">
        <div className="panel-head">
          <div>
            <h2>Agenda del día</h2>
            <p className="muted capitalize">{formatDay(from)}</p>
          </div>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Día" />
        </div>

        <div className="vet-columns">
          {directory.vets.map((vet) => {
            const items = appointments.filter((a) => a.vetId === vet.id);
            return (
              <div className="vet-column" key={vet.id}>
                <header>
                  <strong>{vet.fullName}</strong>
                  <span className="muted">{vet.specialty}</span>
                </header>
                {items.length === 0 && <p className="empty">Sin citas</p>}
                {items.map((a) => {
                  const pet = petById.get(a.petId);
                  const owner = pet ? ownerById.get(pet.ownerId) : undefined;
                  return (
                    <article key={a.id} className={`slot ${a.status === 'CANCELLED' ? 'cancelled' : ''} ${a.modality === 'TELEMEDICINE' ? 'tele' : ''}`}>
                      <div className="slot-time">
                        {formatTime(a.startsAt)} – {formatTime(a.endsAt)}
                      </div>
                      <div className="slot-pet">
                        {pet?.name ?? 'Mascota'} <span className="muted">· {owner?.fullName ?? ''}</span>
                      </div>
                      <div className="slot-reason">{a.reason}</div>
                      <div className="slot-foot">
                        <span className={`badge ${a.modality === 'TELEMEDICINE' ? 'badge-tele' : ''}`}>
                          {a.modality === 'TELEMEDICINE' ? 'Telemedicina' : 'Presencial'}
                        </span>
                        {a.status === 'CANCELLED' && <span className="badge badge-muted">Cancelada</span>}
                        {a.meetingUrl && a.status === 'SCHEDULED' && (
                          <a href={a.meetingUrl} target="_blank" rel="noreferrer">
                            Sala
                          </a>
                        )}
                        {a.status === 'SCHEDULED' && (
                          <button type="button" className="link-button" onClick={() => void handleCancel(a.id)}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel form-panel">
        <h2>Agendar cita</h2>
        <p className="muted">El sistema rechaza horarios que choquen con otra cita del veterinario o de la mascota.</p>
        {notice && <div className={`banner ${notice.kind}`} role="status">{notice.text}</div>}
        <form onSubmit={(e) => void handleSubmit(e)} className="form">
          <label>
            Mascota
            <select value={petId} onChange={(e) => setPetId(e.target.value)} required>
              <option value="">Selecciona…</option>
              {directory.pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.species}) — {ownerById.get(p.ownerId)?.fullName ?? ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Veterinario
            <select value={vetId} onChange={(e) => setVetId(e.target.value)} required>
              <option value="">Selecciona…</option>
              {directory.vets.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.fullName} — {v.specialty}
                </option>
              ))}
            </select>
          </label>
          <div className="row row-time">
            <label>
              Inicio
              <input type="datetime-local" step={900} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </label>
            <label>
              Duración
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="segmented">
            <legend>Modalidad</legend>
            <label className={modality === 'IN_PERSON' ? 'on' : ''}>
              <input type="radio" name="modality" checked={modality === 'IN_PERSON'} onChange={() => setModality('IN_PERSON')} />
              Presencial
            </label>
            <label className={modality === 'TELEMEDICINE' ? 'on' : ''}>
              <input type="radio" name="modality" checked={modality === 'TELEMEDICINE'} onChange={() => setModality('TELEMEDICINE')} />
              Telemedicina
            </label>
          </fieldset>
          <label>
            Motivo
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacuna, revisión, seguimiento…" required maxLength={255} />
          </label>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Agendando…' : 'Agendar cita'}
          </button>
        </form>
      </section>
    </div>
  );
}
