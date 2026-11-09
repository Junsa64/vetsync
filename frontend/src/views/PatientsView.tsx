import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { Directory } from '../App';
import { formatDate } from '../format';
import type { PetProfile } from '../types';

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function PatientsView({ directory, onChange }: { directory: Directory; onChange: () => Promise<void> }) {
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PetProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  const [petOwnerId, setPetOwnerId] = useState('');
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState('Perro');
  const [petBreed, setPetBreed] = useState('');
  const [petBirth, setPetBirth] = useState('');

  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [recordVetId, setRecordVetId] = useState('');

  const loadProfile = useCallback(async (petId: string) => {
    try {
      setProfile(await api.getPetProfile(petId));
    } catch (e: unknown) {
      setError(messageOf(e, 'No se pudo cargar el expediente.'));
    }
  }, []);

  useEffect(() => {
    if (selectedPetId) void loadProfile(selectedPetId);
  }, [selectedPetId, loadProfile]);

  async function createOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const owner = await api.createOwner({ fullName: ownerName, email: ownerEmail, phone: ownerPhone || undefined });
      setOwnerName('');
      setOwnerEmail('');
      setOwnerPhone('');
      setPetOwnerId(owner.id);
      await onChange();
    } catch (e: unknown) {
      setError(messageOf(e, 'No se pudo registrar al dueño.'));
    }
  }

  async function createPet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const pet = await api.createPet({
        ownerId: petOwnerId,
        name: petName,
        species: petSpecies,
        breed: petBreed || undefined,
        birthDate: petBirth || undefined,
      });
      setPetName('');
      setPetBreed('');
      setPetBirth('');
      await onChange();
      setSelectedPetId(pet.id);
    } catch (e: unknown) {
      setError(messageOf(e, 'No se pudo registrar la mascota.'));
    }
  }

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPetId) return;
    setError(null);
    try {
      await api.addMedicalRecord(selectedPetId, {
        diagnosis,
        treatment: treatment || undefined,
        vetId: recordVetId || undefined,
      });
      setDiagnosis('');
      setTreatment('');
      await loadProfile(selectedPetId);
    } catch (e: unknown) {
      setError(messageOf(e, 'No se pudo guardar el registro.'));
    }
  }

  const vetName = (id: string | null) => directory.vets.find((v) => v.id === id)?.fullName ?? 'Sin veterinario';

  return (
    <div className="patients">
      <section className="panel">
        <h2>Dueños y mascotas</h2>
        {error && <div className="banner error">{error}</div>}
        <ul className="owner-list">
          {directory.owners.map((owner) => (
            <li key={owner.id}>
              <div className="owner-line">
                <strong>{owner.fullName}</strong>
                <span className="muted">{owner.email}</span>
              </div>
              <div className="chips">
                {directory.pets
                  .filter((p) => p.ownerId === owner.id)
                  .map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className={p.id === selectedPetId ? 'chip on' : 'chip'}
                      onClick={() => setSelectedPetId(p.id)}
                    >
                      {p.name} <span className="muted">· {p.species}</span>
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>

        <div className="split-forms">
          <form className="form" onSubmit={(e) => void createOwner(e)}>
            <h3>Nuevo dueño</h3>
            <input placeholder="Nombre completo" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
            <input type="email" placeholder="Correo" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
            <input placeholder="Teléfono (opcional)" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
            <button type="submit" className="secondary">Registrar dueño</button>
          </form>
          <form className="form" onSubmit={(e) => void createPet(e)}>
            <h3>Nueva mascota</h3>
            <select value={petOwnerId} onChange={(e) => setPetOwnerId(e.target.value)} required>
              <option value="">Dueño…</option>
              {directory.owners.map((o) => (
                <option key={o.id} value={o.id}>{o.fullName}</option>
              ))}
            </select>
            <input placeholder="Nombre" value={petName} onChange={(e) => setPetName(e.target.value)} required />
            <div className="row">
              <select value={petSpecies} onChange={(e) => setPetSpecies(e.target.value)}>
                {['Perro', 'Gato', 'Ave', 'Conejo', 'Reptil', 'Otro'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <input placeholder="Raza" value={petBreed} onChange={(e) => setPetBreed(e.target.value)} />
            </div>
            <label className="inline-label">
              Nacimiento
              <input type="date" value={petBirth} onChange={(e) => setPetBirth(e.target.value)} />
            </label>
            <button type="submit" className="secondary">Registrar mascota</button>
          </form>
        </div>
      </section>

      <section className="panel">
        {!profile && <p className="empty big">Selecciona una mascota para ver su historial médico.</p>}
        {profile && (
          <>
            <div className="panel-head">
              <div>
                <h2>{profile.pet.name}</h2>
                <p className="muted">
                  {profile.pet.species}
                  {profile.pet.breed ? ` · ${profile.pet.breed}` : ''}
                  {profile.pet.birthDate ? ` · nació el ${formatDate(profile.pet.birthDate)}` : ''} · Dueño: {profile.owner.fullName}
                </p>
              </div>
            </div>
            <h3>Historial médico</h3>
            {profile.history.length === 0 && <p className="empty">Aún no hay registros.</p>}
            <ol className="timeline">
              {profile.history.map((r) => (
                <li key={r.id}>
                  <time>{formatDate(r.recordedAt)}</time>
                  <strong>{r.diagnosis}</strong>
                  {r.treatment && <p>Tratamiento: {r.treatment}</p>}
                  {r.notes && <p className="muted">{r.notes}</p>}
                  <span className="muted small">{vetName(r.vetId)}</span>
                </li>
              ))}
            </ol>
            <form className="form" onSubmit={(e) => void addRecord(e)}>
              <h3>Agregar registro</h3>
              <input placeholder="Diagnóstico" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} required />
              <textarea placeholder="Tratamiento (opcional)" value={treatment} onChange={(e) => setTreatment(e.target.value)} rows={2} />
              <select value={recordVetId} onChange={(e) => setRecordVetId(e.target.value)}>
                <option value="">Veterinario (opcional)</option>
                {directory.vets.map((v) => (
                  <option key={v.id} value={v.id}>{v.fullName}</option>
                ))}
              </select>
              <button type="submit" className="secondary">Guardar en el expediente</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
