'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

type Stock = { size: string; total: number; reserved: number; available: number };
type Item = { size: string; quantity: number };
type Notice = { text: string; kind: 'success' | 'error' } | null;
const STORAGE_KEY = 'laura-active-reservation';
const descriptions: Record<string, string> = { RN: 'Recém-nascido', P: 'Pequeno', M: 'Médio', G: 'Grande', XG: 'Extra grande' };

function Heart({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 32 30" fill="none" aria-hidden="true"><path d="M16 27S3 18 3 9.5C3 2 13 1 16 8c3-7 13-6 13 1.5C29 18 16 27 16 27Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Sprig({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 120 160" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.2"><path d="M33 151C64 114 79 64 83 13M57 115C23 111 18 91 23 86c17-4 30 10 34 29ZM69 86c-31-12-31-30-25-34 18 1 24 17 25 34ZM78 56C53 43 56 26 62 23c14 4 17 18 16 33ZM60 108c31 3 44-14 41-20-16-7-32 5-41 20ZM73 75c27-2 38-18 34-23-17-3-29 8-34 23ZM81 40c21-7 25-22 20-26-13 1-18 12-20 26Z" /></g></svg>;
}
async function api(path: string, body?: unknown) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Não foi possível concluir. Tente novamente.');
  return data;
}
function message(error: unknown) { return error instanceof Error ? error.message : 'Falha de conexão. Tente novamente.'; }

export default function Home() {
  const [stock, setStock] = useState<Stock[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [stockError, setStockError] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reserved, setReserved] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [token, setToken] = useState('');
  const [link, setLink] = useState('');
  const [remembered, setRemembered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [recover, setRecover] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const actionLock = useRef(false);
  const mode = Boolean(token);

  const refresh = useCallback(async () => {
    try { const data = await api('/api/stock'); setStock(data); setLoaded(true); setStockError(''); }
    catch { setStockError('Não conseguimos atualizar a disponibilidade. Tente novamente antes de reservar.'); }
  }, []);

  function remember(t: string) {
    try { if(t) localStorage.setItem(STORAGE_KEY,t); else localStorage.removeItem(STORAGE_KEY); setRemembered(Boolean(t)); } catch { setRemembered(false); }
  }

  const openReservation = useCallback(async (t: string) => {
    if (!/^[a-f0-9]{64}$/.test(t)) throw new Error('Link de reserva inválido. Confira o endereço copiado.');
    const data = await api('/api/reservations/manage', { action: 'get', token: t });
    const saved = Object.fromEntries((data.items as Item[]).map(x => [x.size, x.quantity]));
    setToken(t); setSavedName(data.name); setQuantities(saved); setReserved(saved);
    const url = location.origin + '/#reserva=' + t;
    setLink(url); history.replaceState(null, '', '/#reserva=' + t); remember(t); setRecover(false); setNotice(null);
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      const explicit = new URLSearchParams(location.hash.slice(1)).get('reserva') || new URLSearchParams(location.search).get('reserva');
      let saved = ''; try { saved = localStorage.getItem(STORAGE_KEY) || ''; } catch { /* Private browsing can block storage. */ }
      const t = explicit || saved;
      if (t) {
        history.replaceState(null, '', '/#reserva=' + encodeURIComponent(t));
        try { await openReservation(t); }
        catch (error) {
          if (explicit) setNotice({ text: message(error), kind: 'error' });
          if (message(error).includes('não encontrada') || !/^[a-f0-9]{64}$/.test(t)) { remember(''); if (!explicit) history.replaceState(null, '', '/'); }
        }
      }
      setInitializing(false);
    })();
    const timer = setInterval(() => { if (!actionLock.current) void refresh(); }, 10000);
    return () => clearInterval(timer);
  }, [refresh, openReservation]);

  const chosen = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([size, quantity]) => ({ size, quantity }));
  const selected = chosen.reduce((sum, x) => sum + x.quantity, 0);
  const visibleStock = stock.filter(s => s.total > 0 || reserved[s.size] > 0);
  const total = visibleStock.reduce((sum, s) => sum + s.total, 0);
  const totalReserved = visibleStock.reduce((sum, s) => sum + s.reserved, 0);
  const blocked = busy || initializing;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (actionLock.current || !loaded || stockError) return;
    if (!chosen.length || chosen.some(x => !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 100)) {
      setNotice({ text: 'Escolha pelo menos um pacote, usando quantidades inteiras.', kind: 'error' }); return;
    }
    actionLock.current = true; setBusy(true); setNotice(null);
    try {
      const data = await api(mode ? '/api/reservations/manage' : '/api/reservations', mode ? { action: 'update', token, items: chosen } : { name: name.trim(), items: chosen });
      if (!mode) {
        setToken(data.token); remember(data.token); setSavedName(name.trim());
        const url = location.origin + '/#reserva=' + data.token;
        setLink(url); history.replaceState(null, '', '/#reserva=' + data.token);
      }
      setReserved({ ...quantities });
      setNotice({ text: 'Reserva salva com sucesso! Você pode voltar aqui para alterar ou cancelar.', kind: 'success' });
      await refresh();
    } catch (error) { setNotice({ text: message(error), kind: 'error' }); await refresh(); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function cancel() {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setNotice(null);
    try {
      await api('/api/reservations/manage', { action: 'cancel', token });
      setToken(''); remember(''); setLink(''); setQuantities({}); setReserved({}); setName(''); setSavedName('');
      history.replaceState(null, '', '/');
      setNotice({ text: 'Reserva cancelada. Os pacotes estão disponíveis novamente.', kind: 'success' });
      await refresh();
    } catch (error) { setNotice({ text: message(error), kind: 'error' }); }
    finally { actionLock.current = false; setBusy(false); setConfirmCancel(false); }
  }
  async function recoverReservation(event: FormEvent) {
    event.preventDefault(); if (actionLock.current) return;
    let t = recovery.trim();
    try { const url = new URL(t); t = new URLSearchParams(url.hash.slice(1)).get('reserva') || url.searchParams.get('reserva') || ''; } catch { /* A raw reservation code is also accepted. */ }
    actionLock.current = true; setBusy(true);
    try { await openReservation(t); await refresh(); }
    catch (error) { setNotice({ text: message(error), kind: 'error' }); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setNotice({ text: 'Link privado copiado! Guarde em um lugar seguro.', kind: 'success' }); }
    catch { setNotice({ text: 'Não foi possível copiar automaticamente. Selecione e copie o link abaixo.', kind: 'error' }); }
  }
  function startAnother() {
    remember(''); setToken(''); setLink(''); setName(''); setSavedName(''); setQuantities({}); setReserved({}); setConfirmCancel(false); history.replaceState(null, '', '/');
    setNotice({ text: 'A reserva anterior continua ativa. Para acessá-la depois, use o link privado que você guardou.', kind: 'success' });
  }
  function change(size: string, value: number, max: number) {
    setQuantities(previous => ({ ...previous, [size]: Math.max(0, Math.min(max, Math.trunc(Number.isFinite(value) ? value : 0))) }));
  }

  return <>
    <a className="skip-link" href="#lista">Ir para a lista de fraldas</a>
    <main>
      <header className="invitation">
        <Sprig className="sprig sprig-left" /><Sprig className="sprig sprig-right" />
        <div className="eyebrow">UM PEQUENO AMOR ESTÁ CHEGANDO</div>
        <h1>Chá de Fraldas da <span>Laura</span></h1>
        <div className="heart-divider"><i /><Heart /><i /></div>
        <p className="intro">Um encontro para celebrar a nossa pequena.<br />Sua presença é o presente mais especial!</p>
        <div className="event-details"><span>07 de novembro de 2026</span><b aria-hidden="true">·</b><span>15h</span></div>
        <p className="location">Rua Equador, 1016 · Itaoca</p>
      </header>

      <section className="reservation-card" id="lista" aria-labelledby="list-title">
        <div className="card-heading"><span className="section-kicker">UM CARINHO EM CADA PACOTINHO</span><h2 id="list-title">Vamos preparar a chegada?</h2><p>Escolha os tamanhos e quantos pacotes você quer levar.<br className="desktop-break" /> Depois, volte aqui para alterar ou cancelar sua reserva.</p></div>
        {loaded && <div className="overall"><div><span>Nosso cantinho de fraldas</span><strong>{totalReserved} <span>de {total} pacotes reservados</span></strong></div><div className="progress" role="progressbar" aria-label="Pacotes reservados" aria-valuenow={totalReserved} aria-valuemin={0} aria-valuemax={Math.max(total, totalReserved)}><span style={{ width: `${total ? Math.min(100, totalReserved / total * 100) : 0}%` }} /></div></div>}
        {initializing && <p className="loading" role="status">Preparando sua lista…</p>}
        {stockError && <div role="alert" className="notice error">{stockError}<button type="button" className="text-button" onClick={() => void refresh()} disabled={blocked}>Tentar novamente</button></div>}
        <form onSubmit={submit} aria-busy={blocked}>
          {mode ? <div className="guest-summary"><Heart /><div><small>SEU PRESENTE PARA A LAURA</small><strong>Reserva de {savedName}</strong></div><span>Você pode editar abaixo</span></div> : <div className="name-field"><label htmlFor="name">Como podemos chamar você?</label><input id="name" name="name" autoComplete="name" placeholder="Seu nome e sobrenome" minLength={2} maxLength={80} required value={name} onChange={e => setName(e.target.value)} disabled={blocked} /></div>}
          <div className="sizes-heading"><h3>Escolha seus pacotes</h3><span>Quantidade por tamanho</span></div>
          <div className="size-list">{visibleStock.map(s => {
            const max = Math.max(0, Math.min(100, s.available + (mode ? reserved[s.size] || 0 : 0)));
            const quantity = quantities[s.size] || 0;
            return <div className={`size-row ${s.available === 0 ? 'sold-out' : ''}`} key={s.size}>
              <div className="size-badge">{s.size}</div>
              <div className="size-info"><h4>{descriptions[s.size] || s.size}</h4><p>{s.available > 0 ? <><strong>{s.available}</strong> {s.available === 1 ? 'pacote disponível' : 'pacotes disponíveis'}</> : <span className="sold-label">Todos reservados</span>}</p><div className="mini-progress" aria-hidden="true"><span style={{ width: `${s.total ? Math.min(100, s.reserved / s.total * 100) : 100}%` }} /></div><small>{s.reserved} de {s.total} reservados{mode && reserved[s.size] ? ` · ${reserved[s.size]} na sua reserva` : ''}</small></div>
              <div className="stepper"><button type="button" aria-label={`Diminuir pacotes ${s.size}`} disabled={blocked || quantity === 0} onClick={() => change(s.size, quantity - 1, max)}>−</button><input type="number" inputMode="numeric" step="1" min="0" max={max} aria-label={`Quantidade tamanho ${s.size}`} value={quantity} onChange={e => change(s.size, Number(e.target.value), max)} disabled={blocked || max === 0} /><button type="button" aria-label={`Adicionar pacotes ${s.size}`} disabled={blocked || quantity >= max} onClick={() => change(s.size, quantity + 1, max)}>+</button></div>
            </div>;
          })}</div>
          {loaded && visibleStock.length === 0 && !stockError && <p className="empty">A lista ainda está sendo preparada. Volte em breve.</p>}
          <div className="selection-summary"><Heart /><span>{selected ? <><strong>{selected} {selected === 1 ? 'pacote selecionado' : 'pacotes selecionados'}</strong> para a Laura</> : 'Cada pacotinho é um gesto de amor.'}</span></div>
          <button className="primary-button" type="submit" disabled={blocked || !loaded || Boolean(stockError) || !selected || (!mode && name.trim().length < 2)}>{busy ? 'Aguarde um instante…' : mode ? 'Salvar alterações' : 'Confirmar meu presente'}<span aria-hidden="true">↗</span></button>
          <p className="fine-print">A reserva é confirmada conforme a disponibilidade do momento.</p>
        </form>
        {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`notice ${notice.kind}`}>{notice.text}</div>}
        {mode && <section className="private-link" aria-labelledby="private-title"><div><span className="section-kicker">SUA RESERVA, SEM COMPLICAÇÃO</span><h3 id="private-title">{remembered ? 'Sua reserva está salva neste navegador' : 'Guarde o acesso à sua reserva'}</h3><p>{remembered ? 'Basta voltar a este site, neste mesmo navegador, para alterar ou cancelar. Para usar outro aparelho ou navegador, guarde o link abaixo.' : 'Seu navegador não permitiu salvar automaticamente. Copie o link abaixo para conseguir alterar ou cancelar depois.'} O link é pessoal: quem tiver acesso a ele poderá gerenciar sua reserva.</p></div><input aria-label="Seu link privado de reserva" value={link} readOnly onFocus={e => e.target.select()} /><button type="button" className="secondary-button" onClick={copyLink} disabled={blocked}>Copiar link para guardar</button></section>}
        {mode && <div className="switch-reservation"><button type="button" className="text-button" onClick={startAnother} disabled={blocked}>Esta reserva não é sua? Fazer outra reserva</button></div>}
        {mode && <div className="cancel-area">{confirmCancel ? <div role="group" aria-label="Confirmar cancelamento"><p>Cancelar toda a reserva e liberar os pacotes?</p><div><button type="button" className="secondary-button" onClick={() => setConfirmCancel(false)} disabled={blocked}>Manter minha reserva</button><button type="button" className="danger-button" onClick={cancel} disabled={blocked}>Sim, cancelar reserva</button></div></div> : <button type="button" className="text-button" onClick={() => setConfirmCancel(true)} disabled={blocked}>Quero cancelar minha reserva</button>}</div>}
        {!mode && <div className="recovery"><button type="button" className="text-button" aria-expanded={recover} onClick={() => setRecover(!recover)} disabled={blocked}>Já reservou? Acesse sua reserva</button>{recover && <form onSubmit={recoverReservation}><label htmlFor="recovery">Cole seu link privado ou código de reserva</label><input id="recovery" type="text" value={recovery} onChange={e => setRecovery(e.target.value)} required disabled={blocked} /><button type="submit" className="secondary-button" disabled={blocked || !recovery.trim()}>Acessar minha reserva</button></form>}</div>}
      </section>
      <footer><Heart /><p>Esperamos você para celebrar esse amor.</p><span>Com carinho, Diego e Raynara.</span></footer>
    </main>
  </>;
}
