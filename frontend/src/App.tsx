import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import type { Owner, Pet, Vet } from './types';
import { AgendaView } from './views/AgendaView';
import { PatientsView } from './views/PatientsView';
import { NotificationsView } from './views/NotificationsView';

export interface Directory {
  vets: Vet[];
  pets: Pet[];
  owners: Owner[];
}

type Tab = 'agenda' | 'patients' | 'notifications';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'patients', label: 'Pacientes' },
  { id: 'notifications', label: 'Notificaciones' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('agenda');
  const [directory, setDirectory] = useState<Directory>({ vets: [], pets: [], owners: [] });
  const [loadError, setLoadError] = useState<string | null>(null);

  const reloadDirectory = useCallback(async () => {
    try {
      const [vets, pets, owners] = await Promise.all([api.listVets(), api.listPets(), api.listOwners()]);
      setDirectory({ vets, pets, owners });
      setLoadError(null);
    } catch (error: unknown) {
      setLoadError(error instanceof ApiError ? error.message : 'No se pudo cargar el directorio.');
    }
  }, []);

  useEffect(() => {
    void reloadDirectory();
  }, [reloadDirectory]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✚</span>
          <div>
            <h1>VetSync</h1>
            <p>Citas y telemedicina veterinaria</p>
          </div>
        </div>
        <nav className="tabs" aria-label="Secciones">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === tab ? 'tab active' : 'tab'}
              aria-current={item.id === tab ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {loadError && <div className="banner error">{loadError}</div>}

      <main>
        {tab === 'agenda' && <AgendaView directory={directory} />}
        {tab === 'patients' && <PatientsView directory={directory} onChange={reloadDirectory} />}
        {tab === 'notifications' && <NotificationsView />}
      </main>
    </div>
  );
}
