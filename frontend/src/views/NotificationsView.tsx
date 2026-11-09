import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { formatDateTime } from '../format';
import type { ReminderRunResult, SentEmail } from '../types';

export function NotificationsView() {
  const [outbox, setOutbox] = useState<SentEmail[]>([]);
  const [result, setResult] = useState<ReminderRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOutbox(await api.listOutbox());
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar la bandeja.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runNow() {
    try {
      setResult(await api.runReminders());
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'No se pudieron ejecutar los recordatorios.');
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Bandeja de correo simulado</h2>
          <p className="muted">Confirmaciones al agendar y recordatorios de citas que empiezan en las próximas 24 h. Nada sale a internet.</p>
        </div>
        <button type="button" className="primary" onClick={() => void runNow()}>
          Ejecutar recordatorios ahora
        </button>
      </div>
      {error && <div className="banner error">{error}</div>}
      {result && (
        <div className="banner ok" role="status">
          Recordatorios enviados: {result.sent} · ya enviados antes: {result.skipped} · con error: {result.failed}
        </div>
      )}
      {outbox.length === 0 && <p className="empty">La bandeja está vacía.</p>}
      <ul className="mail-list">
        {outbox.map((mail) => (
          <li key={mail.id}>
            <button type="button" className="mail-row" onClick={() => setOpenId(openId === mail.id ? null : mail.id)} aria-expanded={openId === mail.id}>
              <span className={`badge ${mail.kind === 'REMINDER' ? 'badge-tele' : ''}`}>
                {mail.kind === 'REMINDER' ? 'Recordatorio' : 'Confirmación'}
              </span>
              <span className="mail-subject">{mail.subject}</span>
              <span className="muted small">{mail.to} · {formatDateTime(mail.sentAt)}</span>
            </button>
            {openId === mail.id && <pre className="mail-body">{mail.body}</pre>}
          </li>
        ))}
      </ul>
    </section>
  );
}
