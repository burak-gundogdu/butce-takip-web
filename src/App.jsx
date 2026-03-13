import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, getIdToken,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, onSnapshot,
  collection, addDoc, deleteDoc, getDocs, query, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';

// ─── ADMIN ─────────────────────────────────────────────────────────────────
const ADMIN_UID = 'kHtyEx0LG8VPuEYkj2JPNFZPRy12';

// ─── RENKLER ───────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0E1A', card: '#111827', border: '#1F2937',
  accent: '#6EE7B7', accentBg: '#065F46',
  red: '#F87171', redBg: '#2d0a0a',
  yellow: '#FCD34D', yellowBg: '#1c1400',
  blue: '#60A5FA', blueBg: '#0c1f3d',
  purple: '#A78BFA', purpleBg: '#1a0d2e',
  text: '#F9FAFB', muted: '#6B7280', dim: '#9CA3AF',
  silver: '#CBD5E1', silverBg: '#0d1421',
  green: '#4ade80', orange: '#FB923C',
};

const TROY = 31.1035;
const INIT = {
  startBalance: 0, transactions: [], investments: [],
  subscriptions: [], goals: [], budget: 0,
  debts: [], recurring: [],
  settings: { groqKey: '' },
};

// ─── STİLLER ───────────────────────────────────────────────────────────────
const s = {
  app: { display:'flex', flexDirection:'column', height:'100dvh', background:C.bg, maxWidth:480, margin:'0 auto', position:'relative', overflow:'hidden' },
  header: { padding:'16px 20px 12px', background:'#0D1B2A', flexShrink:0 },
  scrollArea: { flex:1, overflowY:'auto', padding:16, paddingBottom:24 },
  card: { background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:16, marginBottom:12 },
  half: { background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:14, flex:1 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 },
  btn: { background:C.accent, border:'none', borderRadius:12, padding:'14px 20px', cursor:'pointer', fontWeight:800, fontSize:14, color:'#0A0E1A', width:'100%', marginTop:10 },
  btnSec: { background:C.border, border:'none', borderRadius:12, padding:'14px 20px', cursor:'pointer', fontWeight:700, fontSize:14, color:C.dim, width:'100%', marginTop:10 },
  input: { background:'#1F2937', border:`1px solid ${C.border}`, borderRadius:10, padding:'12px', color:C.text, fontSize:14, width:'100%', marginBottom:0 },
  label: { fontSize:10, color:C.muted, letterSpacing:'1.5px', marginBottom:4, display:'block' },
  title: { fontSize:15, fontWeight:700, color:C.text },
  tiny: { fontSize:11, color:C.muted, marginTop:2 },
  body: { fontSize:13, fontWeight:600, color:C.text },
  bigN: { fontSize:20, fontWeight:800, color:C.text },
  nav: { display:'flex', background:C.card, borderTop:`1px solid ${C.border}`, flexShrink:0 },
  navBtn: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 4px 20px', cursor:'pointer', gap:2, border:'none', background:'transparent' },
  chip: { display:'inline-block', padding:'7px 12px', borderRadius:8, cursor:'pointer', marginRight:6, marginBottom:4, fontWeight:600, fontSize:12, flexShrink:0 },
  row: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:`1px solid ${C.border}` },
  txRow: { display:'flex', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.border}` },
  tag: { display:'inline-block', padding:'2px 6px', borderRadius:4, fontSize:10, fontWeight:700 },
};

// ─── YARDIMCILAR ───────────────────────────────────────────────────────────
const fmt = n => '₺' + (n||0).toLocaleString('tr-TR', {maximumFractionDigits:0});
const fmtD = (n,d=2) => (n||0).toLocaleString('tr-TR', {maximumFractionDigits:d, minimumFractionDigits:d});
const todayStr = () => new Date().toLocaleDateString('tr-TR');
const monthKey = (d) => { const dt = d || new Date(); return `${dt.getMonth()+1}/${dt.getFullYear()}`; };
const monthLabel = k => { const [m,y]=k.split('/'); const n=['','Oca','Sub','Mar','Nis','May','Haz','Tem','Agu','Eyl','Eki','Kas','Ara']; return `${n[+m]} ${y.slice(2)}`; };

async function yahooPrice(ticker) {
  const res = await fetch(`/api/price?ticker=${encodeURIComponent(ticker)}`);
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  return d.price;
}
async function fetchRates() {
  const [u, e] = await Promise.all([yahooPrice('USDTRY=X'), yahooPrice('EURTRY=X')]);
  if (!u) throw new Error('Kur alinamadi');
  return { usdTry: u, eurTry: e || u * 1.08 };
}
async function getPriceTL(type, symbol, usdTry) {
  if (type === 'Hisse') { const p = await yahooPrice(symbol.includes('.') ? symbol : `${symbol}.IS`); if (!p) throw new Error(`${symbol} bulunamadi`); return p; }
  if (type === 'Kripto') { const p = await yahooPrice(symbol.includes('-') ? symbol : `${symbol}-USD`); if (!p) throw new Error('Kripto bulunamadi'); return p * usdTry; }
  if (type === 'Altin') { const p = await yahooPrice('GC=F'); if (!p) throw new Error('Altin bulunamadi'); return (p/TROY)*usdTry; }
  if (type === 'Gumus') { const p = await yahooPrice('SI=F'); if (!p) throw new Error('Gumus bulunamadi'); return (p/TROY)*usdTry; }
  if (type === 'Doviz') { const p = await yahooPrice(`${symbol.toUpperCase()}TRY=X`); if (!p) throw new Error('Kur bulunamadi'); return p; }
  return null;
}

function getLast6Months(transactions) {
  const now = new Date();
  return Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-(5-i), 1);
    const key = monthKey(d);
    const txs = transactions.filter(t => t.month === key);
    const income = txs.filter(t => t.type==='gelir').reduce((a,t) => a+t.amount, 0);
    const spent  = txs.filter(t => t.type==='gider').reduce((a,t) => a+t.amount, 0);
    return { key, label: monthLabel(key), income, spent, net: income-spent };
  });
}

// ─── UI BİLEŞENLERİ ────────────────────────────────────────────────────────
function PBar({ pct, color, height=7 }) {
  const c = pct>90 ? C.red : pct>70 ? C.yellow : (color||C.accent);
  return (
    <div style={{height, background:C.border, borderRadius:99, overflow:'hidden', marginTop:6}}>
      <div style={{height:'100%', width:`${Math.min(pct||0,100)}%`, background:c, borderRadius:99, transition:'width 0.3s'}} />
    </div>
  );
}
function Card({ children, style={} }) { return <div style={{...s.card,...style}}>{children}</div>; }
function H({ title, sub }) {
  return <div style={{marginBottom:12}}>
    <div style={s.title}>{title}</div>
    {sub && <div style={s.tiny}>{sub}</div>}
  </div>;
}
function Row({ label, value, color }) {
  return <div style={s.row}>
    <span style={{color:C.dim, fontSize:13}}>{label}</span>
    <span style={{fontWeight:700, color:color||C.text}}>{value}</span>
  </div>;
}
function Chip({ label, active, color, onClick }) {
  return <button onClick={onClick} style={{...s.chip, background: active?(color||C.accent):C.border, color: active?'#0A0E1A':C.dim, border:'none', cursor:'pointer'}}>{label}</button>;
}
function Spinner({ color=C.accent, size=20 }) {
  return <div style={{width:size,height:size,border:`2px solid ${color}33`,borderTop:`2px solid ${color}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />;
}

// ─── FIRESTORE SYNC ────────────────────────────────────────────────────────
function useUserData(uid) {
  const [data, setDataState] = useState(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'data', 'main');
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        setDataState({ ...INIT, ...snap.data() });
      } else {
        setDoc(ref, INIT);
        setDataState({ ...INIT });
      }
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const setData = useCallback((updater) => {
    setDataState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Debounce Firestore write
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const ref = doc(db, 'users', uid, 'data', 'main');
        setDoc(ref, next, { merge: false }).catch(console.error);
      }, 800);
      return next;
    });
  }, [uid]);

  return { data, setData, loading };
}

// ─── AUTH EKRANI ───────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode]   = useState('login');
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [name, setName]   = useState('');
  const [err, setErr]     = useState('');
  const [loading, setL]   = useState(false);

  const submit = async () => {
    setErr(''); setL(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), pass);
      } else {
        if (!name.trim()) { setErr('Ad soyad gerekli'); setL(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
        await updateProfile(cred.user, { displayName: name.trim() });
      }
    } catch (e) {
      const msgs = {
        'auth/user-not-found': 'Kullanici bulunamadi',
        'auth/wrong-password': 'Sifre yanlis',
        'auth/email-already-in-use': 'Bu email zaten kayitli',
        'auth/weak-password': 'Sifre en az 6 karakter olmali',
        'auth/invalid-email': 'Gecersiz email',
        'auth/invalid-credential': 'Email veya sifre yanlis',
      };
      setErr(msgs[e.code] || e.message);
    }
    setL(false);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',height:'100dvh',background:C.bg,padding:24}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {/* Logo */}
      <div style={{marginBottom:40,textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:8}}>₺</div>
        <div style={{fontSize:26,fontWeight:900,color:C.text}}>Butce Takip</div>
        <div style={{fontSize:13,color:C.muted,marginTop:4}}>Kisisel finans yoneticin</div>
      </div>

      <div style={{width:'100%',maxWidth:380}}>
        {/* Tab */}
        <div style={{display:'flex',background:C.card,borderRadius:12,padding:4,marginBottom:24}}>
          {['login','register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(''); }}
              style={{flex:1,padding:'10px',border:'none',borderRadius:9,cursor:'pointer',fontWeight:700,fontSize:13,
                background: mode===m ? C.accent : 'transparent', color: mode===m ? '#0A0E1A' : C.muted, transition:'all 0.2s'}}>
              {m === 'login' ? 'Giris Yap' : 'Kayit Ol'}
            </button>
          ))}
        </div>

        {mode === 'register' && (
          <input style={{...s.input, marginBottom:10}} placeholder="Ad Soyad"
            value={name} onChange={e => setName(e.target.value)} />
        )}
        <input style={{...s.input, marginBottom:10}} placeholder="Email"
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        <input style={{...s.input, marginBottom:10}} placeholder="Sifre (min. 6 karakter)"
          type="password" value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />

        {err && <div style={{background:C.redBg,border:`1px solid ${C.red}`,borderRadius:10,padding:12,marginBottom:10,color:C.red,fontSize:13}}>{err}</div>}

        <button onClick={submit} disabled={loading}
          style={{...s.btn, display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity: loading ? 0.7 : 1}}>
          {loading ? <Spinner color="#0A0E1A" size={18} /> : null}
          {mode === 'login' ? 'Giris Yap' : 'Hesap Olustur'}
        </button>
      </div>
    </div>
  );
}

// ─── GENEL EKRANI ──────────────────────────────────────────────────────────
function HomeScreen({ data, setData, user }) {
  const [rates, setRates]   = useState(null);
  const [metals, setMetals] = useState(null);
  const [rLoad, setRL]      = useState(true);
  const [rErr, setRE]       = useState(null);
  const [editBal, setEB]    = useState(false);
  const [balIn, setBI]      = useState('');

  const income = data.transactions.filter(t => t.type==='gelir').reduce((a,t)=>a+t.amount,0);
  const spent  = data.transactions.filter(t => t.type==='gider').reduce((a,t)=>a+t.amount,0);
  const bal    = (data.startBalance||0) + income - spent;
  const pVal   = data.investments.reduce((a,i)=>a+i.current*(i.adet||1),0);
  const pCost  = data.investments.reduce((a,i)=>a+i.amount*(i.adet||1),0);
  const gain   = pVal - pCost;
  const bPct   = data.budget ? (spent/data.budget)*100 : 0;
  const dayAvg = spent > 0 ? spent / new Date().getDate() : 0;

  const cats = {};
  data.transactions.filter(t => t.type==='gider' && t.month===monthKey()).forEach(t => { cats[t.category]=(cats[t.category]||0)+t.amount; });
  const catColors = [C.accent,C.blue,C.red,C.yellow,C.purple,C.silver];
  const topCats = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const upcoming = data.subscriptions.filter(s => { const d=new Date().getDate(); return s.day>=d && s.day-d<=5; }).sort((a,b)=>a.day-b.day);
  const unpaidDebts = (data.debts||[]).filter(d=>!d.paid);


  const announcements = useAnnouncements();
  const loadRates = useCallback(async () => {
    setRL(true); setRE(null);
    try {
      const r = await fetchRates(); setRates(r);
      const [g,sv] = await Promise.all([yahooPrice('GC=F'), yahooPrice('SI=F')]);
      setMetals({ goldGram: g?(g/TROY)*r.usdTry:null, silverGram: sv?(sv/TROY)*r.usdTry:null, goldUSD:g, silverUSD:sv });
    } catch(e) { setRE(e.message); }
    setRL(false);
  }, []);

  useEffect(() => { loadRates(); }, []);

  return (
    <div style={s.scrollArea}>
      {/* Sadece admin duyurulari (haber degil) */}
      {announcements.filter(a => a.tip !== 'haber').length > 0 && (
        <div style={{marginBottom:4}}>
          {announcements.filter(a => a.tip !== 'haber').map(ann => <AnnouncementCard key={ann.id} ann={ann} />)}
        </div>
      )}
      {/* Bakiye */}
      <Card style={{background:'#0D1B2A', borderColor:C.accentBg}}>
        <span style={s.label}>TOPLAM BAKIYE</span>
        <div style={{fontSize:38,fontWeight:900,color:C.text,letterSpacing:-1,margin:'4px 0'}}>{fmt(bal)}</div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{color:gain>=0?C.accent:C.red,fontWeight:700,fontSize:13}}>
            Portfoy {gain>=0?'+':''}{pCost?(((gain/pCost)*100).toFixed(1)):0}%  ({fmt(gain)})
          </span>
          <button onClick={()=>setEB(!editBal)}
            style={{background:C.accentBg,border:'none',borderRadius:8,padding:'4px 10px',color:C.accent,fontSize:11,fontWeight:700,cursor:'pointer'}}>
            {editBal?'Kapat':'Guncelle'}
          </button>
        </div>
        {editBal && (
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <input style={{...s.input,flex:1}} placeholder="Baslangic bakiyesi (TL)"
              type="number" value={balIn} onChange={e=>setBI(e.target.value)} />
            <button onClick={()=>{ setData(d=>({...d,startBalance:parseFloat(balIn)||0})); setEB(false); setBI(''); }}
              style={{background:C.accent,border:'none',borderRadius:10,padding:'0 14px',fontWeight:700,color:'#0A0E1A',cursor:'pointer'}}>
              Kaydet
            </button>
          </div>
        )}
      </Card>

      {/* Ozet grid */}
      <div style={s.grid2}>
        <Card style={s.half}>
          <span style={s.label}>BUTCE</span>
          <div style={s.bigN}>{fmt(data.budget)}</div>
          <PBar pct={bPct} />
          <div style={{...s.tiny,marginTop:4,color:bPct>90?C.red:C.muted}}>{fmt(Math.max(0,data.budget-spent))} kaldi</div>
        </Card>
        <Card style={s.half}>
          <span style={s.label}>PORTFOY</span>
          <div style={s.bigN}>{fmt(pVal)}</div>
          <div style={{fontSize:12,color:gain>=0?C.accent:C.red,fontWeight:700,marginTop:4}}>{gain>=0?'+':''}{fmt(gain)}</div>
        </Card>
      </div>

      {/* Bu ay */}
      <Card>
        <H title="Bu Ay" sub={monthLabel(monthKey())} />
        <Row label="Gelir" value={fmt(income)} color={C.accent} />
        <Row label="Gider" value={fmt(spent)} color={C.red} />
        <Row label="Net" value={fmt(income-spent)} color={income-spent>=0?C.accent:C.red} />
        <Row label="Gunluk ort." value={fmt(dayAvg)} color={C.blue} />
        <Row label="Abonelikler" value={fmt(data.subscriptions.reduce((a,s)=>a+s.amount,0))} color={C.purple} />
      </Card>

      {/* Kategoriler */}
      {topCats.length > 0 && (
        <Card>
          <H title="Harcama Dagilimi" />
          {topCats.map(([cat,amt],i) => (
            <div key={i} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={s.body}>{cat}</span>
                <div style={{textAlign:'right'}}>
                  <div style={{color:catColors[i%6],fontWeight:700,fontSize:13}}>{fmt(amt)}</div>
                  <div style={s.tiny}>%{((amt/spent)*100).toFixed(0)}</div>
                </div>
              </div>
              <PBar pct={(amt/spent)*100} color={catColors[i%6]} />
            </div>
          ))}
        </Card>
      )}

      {/* Yaklasan abonelikler */}
      {upcoming.length > 0 && (
        <Card style={{borderColor:C.purple}}>
          <H title="Yaklasan Odemeler" sub="5 gun icinde" />
          {upcoming.map(s => {
            const dl = s.day - new Date().getDate();
            return (
              <div key={s.id} style={s.txRow}>
                <div style={{flex:1}}>
                  <div style={s.body}>{s.name}</div>
                  <div style={{...s.tiny,color:dl<=1?C.red:C.muted}}>{dl===0?'Bugun!':`${dl} gun sonra`}</div>
                </div>
                <span style={{fontWeight:800,color:C.purple}}>{fmt(s.amount)}</span>
              </div>
            );
          })}
        </Card>
      )}

      {/* Odenmemis borclar */}
      {unpaidDebts.length > 0 && (
        <Card style={{borderColor:C.orange}}>
          <H title="Bekleyen Borclar" sub={`${unpaidDebts.length} adet`} />
          {unpaidDebts.slice(0,3).map(d => (
            <div key={d.id} style={s.txRow}>
              <div style={{flex:1}}>
                <div style={s.body}>{d.name}</div>
                <div style={s.tiny}>{d.type==='bende'?'Ben borclu':'Bende alacak'}</div>
              </div>
              <span style={{fontWeight:800,color:d.type==='bende'?C.red:C.accent}}>{fmt(d.amount)}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Canli kurlar */}
      <Card>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <H title="Canli Kurlar" sub="Yahoo Finance" />
          <button onClick={loadRates} style={{background:C.border,border:'none',borderRadius:8,padding:'6px 12px',color:C.accent,fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            {rLoad ? <Spinner size={14}/> : '↺'} Guncelle
          </button>
        </div>
        {rErr && <div style={{background:C.redBg,borderRadius:10,padding:10,marginBottom:10,color:C.red,fontSize:12}}>Hata: {rErr}</div>}
        {rates && (
          <>
            <div style={{display:'flex',alignItems:'center',padding:'9px 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:20,marginRight:10}}>🇺🇸</span>
              <span style={{flex:1,color:C.dim,fontSize:14}}>USD / TRY</span>
              <span style={{fontSize:16,fontWeight:800,color:C.text}}>{fmtD(rates.usdTry)} ₺</span>
            </div>
            <div style={{display:'flex',alignItems:'center',padding:'9px 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:20,marginRight:10}}>🇪🇺</span>
              <span style={{flex:1,color:C.dim,fontSize:14}}>EUR / TRY</span>
              <span style={{fontSize:16,fontWeight:800,color:C.text}}>{fmtD(rates.eurTry)} ₺</span>
            </div>
          </>
        )}
        {metals?.goldGram != null && (
          <div style={{display:'flex',alignItems:'center',background:C.yellowBg,border:`1px solid #78350f`,borderRadius:12,padding:12,marginTop:8}}>
            <span style={{fontSize:22}}>🥇</span>
            <div style={{flex:1,marginLeft:10}}>
              <div style={{color:C.yellow,fontWeight:700,fontSize:13}}>Altin (gram TL)</div>
              <div style={s.tiny}>${fmtD(metals.goldUSD,0)} / oz</div>
            </div>
            <span style={{fontSize:20,fontWeight:900,color:C.yellow}}>{fmtD(metals.goldGram,0)} ₺</span>
          </div>
        )}
        {metals?.silverGram != null && (
          <div style={{display:'flex',alignItems:'center',background:C.silverBg,border:`1px solid #334155`,borderRadius:12,padding:12,marginTop:8}}>
            <span style={{fontSize:22}}>🥈</span>
            <div style={{flex:1,marginLeft:10}}>
              <div style={{color:C.silver,fontWeight:700,fontSize:13}}>Gumus (gram TL)</div>
              <div style={s.tiny}>${fmtD(metals.silverUSD,2)} / oz</div>
            </div>
            <span style={{fontSize:20,fontWeight:900,color:C.silver}}>{fmtD(metals.silverGram,1)} ₺</span>
          </div>
        )}
      </Card>

      {/* Son islemler */}
      <Card>
        <H title="Son Islemler" />
        {data.transactions.length === 0 ? <div style={{...s.tiny,textAlign:'center',padding:'16px 0'}}>Henuz islem yok</div>
          : data.transactions.slice(0,7).map(t => (
            <div key={t.id} style={s.txRow}>
              <div style={{width:6,height:6,borderRadius:3,marginRight:10,background:t.type==='gelir'?C.accent:C.red,flexShrink:0}} />
              <div style={{flex:1}}>
                <div style={s.body}>{t.note||t.category}</div>
                <div style={s.tiny}>{t.category} — {t.date}</div>
              </div>
              <span style={{fontWeight:700,color:t.type==='gelir'?C.accent:C.red}}>{t.type==='gelir'?'+':'-'}{fmt(t.amount)}</span>
            </div>
          ))}
      </Card>
    </div>
  );
}

// ─── BÜTÇE EKRANI ──────────────────────────────────────────────────────────
const TX_CATS = ['Market','Kira','Faturalar','Ulasim','Yemek','Saglik','Giyim','Eglence','Maas','Diger'];
const QUICK = [{e:'🛒',l:'Market',c:'Market'},{e:'⛽',l:'Benzin',c:'Ulasim'},{e:'🍽️',l:'Yemek',c:'Yemek'},{e:'☕',l:'Kafe',c:'Yemek'},{e:'💊',l:'Eczane',c:'Saglik'},{e:'🧾',l:'Fatura',c:'Faturalar'}];

function BudgetScreen({ data, setData }) {
  const [type, setType] = useState('gider');
  const [cat, setCat]   = useState('Market');
  const [amt, setAmt]   = useState('');
  const [note, setNote] = useState('');
  const [bIn, setBI]    = useState('');
  const [gName,setGN]   = useState(''); const [gTgt,setGT]=useState(''); const [gCur,setGC]=useState('');
  const [dName,setDN]   = useState(''); const [dAmt,setDA]=useState(''); const [dType,setDT]=useState('bende'); const [dNote,setDNote]=useState('');
  const [srch, setSrch] = useState('');
  const [qItem, setQI]  = useState(null);
  const [qAmt, setQA]   = useState('');

  const income = data.transactions.filter(t=>t.type==='gelir').reduce((a,t)=>a+t.amount,0);
  const spent  = data.transactions.filter(t=>t.type==='gider').reduce((a,t)=>a+t.amount,0);
  const bPct   = data.budget?(spent/data.budget)*100:0;
  const filtered = srch ? data.transactions.filter(t=>(t.note||'').toLowerCase().includes(srch.toLowerCase())||t.category.toLowerCase().includes(srch.toLowerCase())) : data.transactions;
  const borcBende    = (data.debts||[]).filter(d=>d.type==='bende'&&!d.paid).reduce((a,d)=>a+d.amount,0);
  const borcBendeVar = (data.debts||[]).filter(d=>d.type==='bendvar'&&!d.paid).reduce((a,d)=>a+d.amount,0);

  const addTx  = () => { if(!amt) return; setData(d=>({...d,transactions:[{id:Date.now(),type,category:cat,amount:parseFloat(amt),date:todayStr(),note:note||cat,month:monthKey()},...d.transactions]})); setAmt('');setNote(''); };
  const addQ   = () => { if(!qAmt||!qItem) return; setData(d=>({...d,transactions:[{id:Date.now(),type:'gider',category:qItem.c,amount:parseFloat(qAmt),date:todayStr(),note:`${qItem.e} ${qItem.l}`,month:monthKey()},...d.transactions]})); setQI(null);setQA(''); };
  const delTx  = id => setData(d=>({...d,transactions:d.transactions.filter(t=>t.id!==id)}));
  const saveBudget = () => { if(!bIn) return; setData(d=>({...d,budget:parseFloat(bIn)})); setBI(''); };
  const addGoal = () => { if(!gName||!gTgt) return; setData(d=>({...d,goals:[...(d.goals||[]),{id:Date.now(),name:gName,target:parseFloat(gTgt),current:parseFloat(gCur)||0}]})); setGN('');setGT('');setGC(''); };
  const delGoal = id => setData(d=>({...d,goals:d.goals.filter(g=>g.id!==id)}));
  const updGoal = (id,v) => setData(d=>({...d,goals:d.goals.map(g=>g.id===id?{...g,current:parseFloat(v)||0}:g)}));
  const addDebt = () => { if(!dName||!dAmt) return; setData(d=>({...d,debts:[...(d.debts||[]),{id:Date.now(),name:dName,amount:parseFloat(dAmt),type:dType,note:dNote,date:todayStr(),paid:false}]})); setDN('');setDA('');setDNote(''); };
  const toggleDebt = id => setData(d=>({...d,debts:d.debts.map(b=>b.id===id?{...b,paid:!b.paid}:b)}));
  const delDebt    = id => setData(d=>({...d,debts:d.debts.filter(b=>b.id!==id)}));

  return (
    <div style={s.scrollArea}>
      {bPct>90&&data.budget>0&&<div style={{background:C.redBg,border:`1px solid ${C.red}`,borderRadius:12,padding:12,marginBottom:12,color:C.red,fontWeight:700,fontSize:13}}>Butcenin %{bPct.toFixed(0)}'ini kullandin! {fmt(Math.max(0,data.budget-spent))} kaldi.</div>}

      <div style={s.grid2}>
        <Card style={s.half}><span style={s.label}>GELIR</span><div style={{...s.bigN,color:C.accent}}>+{fmt(income)}</div></Card>
        <Card style={s.half}><span style={s.label}>GIDER</span><div style={{...s.bigN,color:C.red}}>-{fmt(spent)}</div></Card>
      </div>

      <Card>
        <H title="Aylik Butce" />
        <div style={{fontSize:22,fontWeight:800,color:C.text}}>{fmt(data.budget)}</div>
        <PBar pct={bPct} />
        <div style={{...s.tiny,margin:'4px 0 12px'}}>{fmt(spent)} harcandi — {fmt(Math.max(0,data.budget-spent))} kaldi</div>
        <div style={{display:'flex',gap:8}}>
          <input style={{...s.input,flex:1}} placeholder="Yeni limit (TL)" type="number" value={bIn} onChange={e=>setBI(e.target.value)} />
          <button onClick={saveBudget} style={{background:C.accent,border:'none',borderRadius:10,padding:'0 14px',fontWeight:700,color:'#0A0E1A',cursor:'pointer',whiteSpace:'nowrap'}}>Kaydet</button>
        </div>
      </Card>

      {/* Hizli ekle */}
      <Card>
        <H title="Hizli Ekle" sub="Tek tiklama gider" />
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {QUICK.map((q,i)=>(
            <button key={i} onClick={()=>setQI(q)} style={{background:C.border,border:'none',borderRadius:12,padding:'9px 14px',color:C.text,fontSize:13,fontWeight:600,cursor:'pointer'}}>
              {q.e} {q.l}
            </button>
          ))}
        </div>
        {qItem && (
          <div style={{marginTop:12,display:'flex',gap:8}}>
            <input style={{...s.input,flex:1}} placeholder={`${qItem.e} ${qItem.l} - Tutar (TL)`} type="number" autoFocus value={qAmt} onChange={e=>setQA(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addQ()} />
            <button onClick={addQ} style={{background:C.accent,border:'none',borderRadius:10,padding:'0 14px',fontWeight:700,color:'#0A0E1A',cursor:'pointer'}}>Ekle</button>
            <button onClick={()=>{setQI(null);setQA('');}} style={{background:C.border,border:'none',borderRadius:10,padding:'0 10px',color:C.muted,cursor:'pointer'}}>X</button>
          </div>
        )}
      </Card>

      {/* Hedefler */}
      <Card>
        <H title="Tasarruf Hedefleri" />
        {(!data.goals||data.goals.length===0)?<div style={{...s.tiny,textAlign:'center',padding:'12px 0'}}>Henuz hedef yok</div>
          :data.goals.map(g=>{
            const pct=Math.min((g.current/g.target)*100,100); const done=pct>=100;
            return <div key={g.id} style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{...s.body,color:done?C.green:C.text}}>{g.name}{done?' ✓':''}</span>
                <button onClick={()=>delGoal(g.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:16}}>X</button>
              </div>
              <PBar pct={pct} color={done?C.green:C.blue} />
              <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                <span style={s.tiny}>{fmt(g.current)} birikti</span>
                <span style={{...s.tiny,color:done?C.green:C.dim}}>{fmt(g.target)} hedef — %{pct.toFixed(0)}</span>
              </div>
              {!done && <input style={{...s.input,marginTop:8,padding:8,fontSize:12}} placeholder="Birikimi guncelle (TL)" type="number" defaultValue={g.current} onBlur={e=>updGoal(g.id,e.target.value)} />}
            </div>;
          })}
        <input style={{...s.input,marginBottom:8}} placeholder="Hedef adi (orn: Tatil)" value={gName} onChange={e=>setGN(e.target.value)} />
        <input style={{...s.input,marginBottom:8}} placeholder="Hedef tutar (TL)" type="number" value={gTgt} onChange={e=>setGT(e.target.value)} />
        <input style={{...s.input,marginBottom:8}} placeholder="Mevcut birikim (TL)" type="number" value={gCur} onChange={e=>setGC(e.target.value)} />
        <button onClick={addGoal} style={{...s.btn,background:C.purple}}>+ Hedef Ekle</button>
      </Card>

      {/* Borc takibi */}
      <Card>
        <H title="Borc Takibi" />
        <div style={s.grid2}>
          <div style={{background:C.redBg,border:`1px solid ${C.red}`,borderRadius:10,padding:10}}>
            <div style={{...s.tiny,color:C.red}}>BENIM BORCUM</div>
            <div style={{color:C.red,fontWeight:800,fontSize:16}}>{fmt(borcBende)}</div>
          </div>
          <div style={{background:C.accentBg,border:`1px solid ${C.accent}`,borderRadius:10,padding:10}}>
            <div style={{...s.tiny,color:C.accent}}>BENDE OLAN</div>
            <div style={{color:C.accent,fontWeight:800,fontSize:16}}>{fmt(borcBendeVar)}</div>
          </div>
        </div>
        {(data.debts||[]).length===0?<div style={{...s.tiny,textAlign:'center',padding:'12px 0'}}>Kayitli borc yok</div>
          :(data.debts||[]).map(d=>(
            <div key={d.id} style={{...s.txRow,opacity:d.paid?0.5:1}}>
              <div style={{flex:1}}>
                <span style={{...s.body,textDecoration:d.paid?'line-through':'none'}}>{d.name}</span>
                <div style={s.tiny}>{d.type==='bende'?'Ben borclu':'Bende alacak'} — {d.date}{d.note?` — ${d.note}`:''}</div>
              </div>
              <span style={{fontWeight:800,color:d.type==='bende'?C.red:C.accent,marginRight:8}}>{fmt(d.amount)}</span>
              <button onClick={()=>toggleDebt(d.id)} style={{background:'none',border:'none',cursor:'pointer',marginRight:6,fontSize:16,color:d.paid?C.green:C.muted}}>{d.paid?'✓':'○'}</button>
              <button onClick={()=>delDebt(d.id)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:14}}>X</button>
            </div>
          ))}
        <div style={{marginTop:12}}>
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            {['bende','bendvar'].map(t=>(
              <button key={t} onClick={()=>setDT(t)} style={{flex:1,padding:10,border:'none',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:12,background:dType===t?(t==='bende'?C.red:C.accent):C.border,color:dType===t?'#0A0E1A':C.muted}}>
                {t==='bende'?'Ben borclu':'Bende alacak'}
              </button>
            ))}
          </div>
          <input style={{...s.input,marginBottom:8}} placeholder="Kisi adi" value={dName} onChange={e=>setDN(e.target.value)} />
          <input style={{...s.input,marginBottom:8}} placeholder="Tutar (TL)" type="number" value={dAmt} onChange={e=>setDA(e.target.value)} />
          <input style={{...s.input,marginBottom:8}} placeholder="Not (opsiyonel)" value={dNote} onChange={e=>setDNote(e.target.value)} />
          <button onClick={addDebt} style={{...s.btn,background:C.orange}}>+ Borc Ekle</button>
        </div>
      </Card>

      {/* Islem ekle */}
      <Card>
        <H title="Islem Ekle" />
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          {['gider','gelir'].map(t=>(
            <button key={t} onClick={()=>setType(t)} style={{flex:1,padding:10,border:'none',borderRadius:10,cursor:'pointer',fontWeight:700,background:type===t?(t==='gelir'?C.accent:C.red):C.border,color:type===t?'#0A0E1A':C.muted}}>
              {t==='gelir'?'+ Gelir':'- Gider'}
            </button>
          ))}
        </div>
        <div style={{display:'flex',overflowX:'auto',paddingBottom:8,marginBottom:8}}>
          {TX_CATS.map(c=><Chip key={c} label={c} active={cat===c} onClick={()=>setCat(c)} />)}
        </div>
        <input style={{...s.input,marginBottom:8}} placeholder="Tutar (TL)" type="number" value={amt} onChange={e=>setAmt(e.target.value)} />
        <input style={{...s.input,marginBottom:8}} placeholder="Not (opsiyonel)" value={note} onChange={e=>setNote(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTx()} />
        <button onClick={addTx} style={s.btn}>+ Ekle</button>
      </Card>

      {/* Liste */}
      <Card>
        <H title={`Tum Islemler (${data.transactions.length})`} />
        <input style={{...s.input,marginBottom:10}} placeholder="Ara..." value={srch} onChange={e=>setSrch(e.target.value)} />
        {filtered.length===0?<div style={{...s.tiny,textAlign:'center',padding:'16px 0'}}>{srch?'Sonuc yok':'Henuz islem yok'}</div>
          :filtered.map(t=>(
            <div key={t.id} style={s.txRow}>
              <div style={{width:6,height:6,borderRadius:3,marginRight:10,background:t.type==='gelir'?C.accent:C.red,flexShrink:0}} />
              <div style={{flex:1}}>
                <div style={s.body}>{t.note}</div>
                <div style={s.tiny}>{t.category} — {t.date}</div>
              </div>
              <span style={{fontWeight:700,color:t.type==='gelir'?C.accent:C.red,marginRight:10}}>{t.type==='gelir'?'+':'-'}{fmt(t.amount)}</span>
              <button onClick={()=>delTx(t.id)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:16}}>X</button>
            </div>
          ))}
      </Card>
    </div>
  );
}

// ─── YATIRIM EKRANI ────────────────────────────────────────────────────────
const INV_TYPES = ['Hisse','Kripto','Altin','Gumus','Doviz'];
const T_COLOR = {Hisse:C.blue,Kripto:C.purple,Altin:C.yellow,Gumus:C.silver,Doviz:C.accent};
const T_ICON  = {Hisse:'📈',Kripto:'₿',Altin:'🥇',Gumus:'🥈',Doviz:'💱'};

function InvestmentScreen({ data, setData }) {
  const [itype,setIT]     = useState('Hisse');
  const [symbol,setSym]   = useState('');
  const [adet,setAdet]    = useState('');
  const [alis,setAlis]    = useState('');
  const [cur,setCur]      = useState('');
  const [fetching,setF]   = useState(false);
  const [updId,setUpdId]  = useState(null);
  const [bulkUpd,setBulk] = useState(false);
  const [usdTry,setUSD]   = useState(null);

  useEffect(() => { fetchRates().then(r=>setUSD(r.usdTry)).catch(()=>{}); }, []);

  const totalCost = data.investments.reduce((a,i)=>a+i.amount*(i.adet||1),0);
  const totalVal  = data.investments.reduce((a,i)=>a+i.current*(i.adet||1),0);
  const gain      = totalVal - totalCost;
  const gainPct   = totalCost?((gain/totalCost)*100).toFixed(1):'0.0';
  const breakdown = INV_TYPES.map(t=>({type:t,val:data.investments.filter(i=>i.type===t).reduce((a,i)=>a+i.current*(i.adet||1),0)})).filter(x=>x.val>0);

  const autoFetch = async () => {
    const needsSym = itype==='Hisse'||itype==='Kripto'||itype==='Doviz';
    if(needsSym&&!symbol) return alert('Sembol girin');
    setF(true);
    try {
      const price = await getPriceTL(itype, symbol, usdTry);
      if(price) { setCur(price.toFixed(2)); alert(`Fiyat: ${fmtD(price)} TL`); }
      else alert('Fiyat bulunamadi');
    } catch(e) { alert('Hata: '+e.message); }
    setF(false);
  };

  const updateOne = async (inv) => {
    setUpdId(inv.id);
    try {
      const price = await getPriceTL(inv.type, inv.symbol, usdTry);
      if(price) {
        const chg = (((price-inv.amount)/inv.amount)*100).toFixed(2);
        setData(d=>({...d,investments:d.investments.map(i=>i.id===inv.id?{...i,current:price,change:parseFloat(chg)}:i)}));
      }
    } catch(e) { alert('Hata: '+e.message); }
    setUpdId(null);
  };

  const bulkUpdate = async () => {
    setBulk(true);
    let newInv = [...data.investments]; let ok=0;
    for(const inv of data.investments) {
      if(!((inv.type==='Hisse'||inv.type==='Kripto')&&inv.symbol)&&inv.type!=='Altin'&&inv.type!=='Gumus') continue;
      try {
        const price = await getPriceTL(inv.type, inv.symbol, usdTry);
        if(price) { const chg=(((price-inv.amount)/inv.amount)*100).toFixed(2); newInv=newInv.map(i=>i.id===inv.id?{...i,current:price,change:parseFloat(chg)}:i); ok++; }
      } catch {}
      await new Promise(r=>setTimeout(r,300));
    }
    setData(d=>({...d,investments:newInv}));
    alert(`${ok}/${data.investments.length} varlik guncellendi`);
    setBulk(false);
  };

  const add = () => {
    if(!alis) return;
    const name = itype==='Altin'?'Altin (gram)':itype==='Gumus'?'Gumus (gram)':(symbol.toUpperCase()||itype);
    const a=parseFloat(alis); const c=parseFloat(cur)||a; const ad=parseFloat(adet)||1;
    setData(d=>({...d,investments:[...d.investments,{id:Date.now(),type:itype,name,symbol:symbol.toUpperCase(),adet:ad,amount:a,current:c,change:parseFloat((((c-a)/a)*100).toFixed(2))}]}));
    setSym('');setAdet('');setAlis('');setCur('');
  };
  const del = id => setData(d=>({...d,investments:d.investments.filter(i=>i.id!==id)}));

  return (
    <div style={s.scrollArea}>
      <Card style={{background:'#0D1B2A',borderColor:C.accentBg}}>
        <span style={s.label}>TOPLAM PORTFOY</span>
        <div style={{fontSize:32,fontWeight:900,color:C.text,marginBottom:4}}>{fmt(totalVal)}</div>
        <div style={{color:gain>=0?C.accent:C.red,fontWeight:700,fontSize:15,marginBottom:4}}>{gain>=0?'+':''}{fmt(gain)}  ({gain>=0?'+':''}{gainPct}%)</div>
        <Row label="Toplam Maliyet" value={fmt(totalCost)} />
        <button onClick={bulkUpdate} style={{...s.btn,background:C.accentBg,border:`1px solid ${C.accent}`,color:C.accent,marginTop:12,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {bulkUpd?<Spinner size={16}/>:null} Tum Portfoyu Guncelle
        </button>
      </Card>

      {breakdown.length>1&&(
        <Card>
          <H title="Portfoy Dagilimi" />
          {breakdown.map((t,i)=>(
            <div key={i} style={{marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={s.body}>{T_ICON[t.type]} {t.type}</span>
                <div style={{textAlign:'right'}}>
                  <div style={{color:T_COLOR[t.type],fontWeight:700,fontSize:13}}>{fmt(t.val)}</div>
                  <div style={s.tiny}>%{totalVal?((t.val/totalVal)*100).toFixed(0):0}</div>
                </div>
              </div>
              <PBar pct={totalVal?(t.val/totalVal)*100:0} color={T_COLOR[t.type]} />
            </div>
          ))}
        </Card>
      )}

      {INV_TYPES.map(type=>{
        const items=data.investments.filter(i=>i.type===type);
        if(!items.length) return null;
        const color=T_COLOR[type];
        return (
          <Card key={type}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:18}}>{T_ICON[type]}</span>
                <span style={s.title}>{type}</span>
              </div>
              <span style={{background:color+'25',color,fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:8}}>{items.length} varlik</span>
            </div>
            {items.map(inv=>{
              const tVal=inv.current*(inv.adet||1); const tCost=inv.amount*(inv.adet||1); const ig=tVal-tCost;
              return (
                <div key={inv.id} style={{...s.txRow,alignItems:'flex-start',paddingTop:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={s.body}>{inv.name}</span>
                      {inv.symbol&&<span style={{background:color+'22',color,fontSize:10,fontWeight:700,padding:'2px 5px',borderRadius:4}}>{inv.symbol}</span>}
                    </div>
                    <div style={s.tiny}>Adet: {inv.adet||1}  |  Alis: {fmtD(inv.amount)} TL</div>
                    <div style={s.tiny}>Guncel: {fmtD(inv.current)} TL</div>
                    <div style={{...s.tiny,color:ig>=0?C.accent:C.red,fontWeight:700,marginTop:2}}>{ig>=0?'+':''}{fmt(ig)}  ({inv.change>=0?'+':''}{inv.change}%)</div>
                  </div>
                  <div style={{textAlign:'right',marginRight:8}}>
                    <div style={{fontWeight:800,color:C.text,fontSize:15}}>{fmt(tVal)}</div>
                    <button onClick={()=>updateOne(inv)} style={{background:color+'22',border:'none',borderRadius:6,padding:'3px 8px',color,fontSize:10,fontWeight:700,cursor:'pointer',marginTop:5,display:'flex',alignItems:'center',gap:4}}>
                      {updId===inv.id?<Spinner color={color} size={12}/>:null} Guncelle
                    </button>
                  </div>
                  <button onClick={()=>del(inv.id)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:16,paddingTop:2}}>X</button>
                </div>
              );
            })}
          </Card>
        );
      })}

      {data.investments.length===0&&<Card><div style={{...s.tiny,textAlign:'center',padding:'16px 0'}}>Henuz yatirim eklenmedi</div></Card>}

      <Card>
        <H title="Yatirim Ekle" />
        <div style={{display:'flex',overflowX:'auto',paddingBottom:8,marginBottom:12}}>
          {INV_TYPES.map(t=><Chip key={t} label={`${T_ICON[t]} ${t}`} active={itype===t} color={T_COLOR[t]} onClick={()=>{setIT(t);setSym('');setCur('');}} />)}
        </div>

        {(itype==='Hisse'||itype==='Kripto'||itype==='Doviz')&&(
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <input style={{...s.input,flex:1}} placeholder={itype==='Hisse'?'BIST sembol (THYAO)':itype==='Kripto'?'Sembol (BTC, ETH)':'Doviz (USD, EUR)'}
              value={symbol} onChange={e=>setSym(e.target.value.toUpperCase())} />
            <button onClick={autoFetch} style={{background:T_COLOR[itype],border:'none',borderRadius:10,padding:'0 14px',fontWeight:800,color:'#0A0E1A',cursor:'pointer',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
              {fetching?<Spinner color="#0A0E1A" size={14}/>:null} Fiyat Cek
            </button>
          </div>
        )}

        {(itype==='Altin'||itype==='Gumus')&&(
          <button onClick={autoFetch} style={{background:itype==='Altin'?C.yellowBg:C.silverBg,border:`1px solid ${itype==='Altin'?C.yellow:C.silver}`,borderRadius:12,padding:12,width:'100%',color:itype==='Altin'?C.yellow:C.silver,fontWeight:800,cursor:'pointer',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            {fetching?<Spinner color={itype==='Altin'?C.yellow:C.silver} size={16}/>:null}
            Canli {itype==='Altin'?'Altin':'Gumus'} Gram Fiyatini Cek
          </button>
        )}

        {cur&&<div style={{...s.tiny,color:T_COLOR[itype],marginBottom:8}}>Fiyat: {fmtD(parseFloat(cur))} TL</div>}

        <input style={{...s.input,marginBottom:8}} placeholder={itype==='Altin'||itype==='Gumus'?'Miktar (gram)':'Adet'} type="number" value={adet} onChange={e=>setAdet(e.target.value)} />
        <input style={{...s.input,marginBottom:8}} placeholder="Alis fiyati (TL)" type="number" value={alis} onChange={e=>setAlis(e.target.value)} />
        <input style={{...s.input,marginBottom:8}} placeholder="Guncel fiyat (TL)" type="number" value={cur} onChange={e=>setCur(e.target.value)} />
        <button onClick={add} style={s.btn}>+ Ekle</button>
      </Card>
    </div>
  );
}

// ─── İSTATİSTİK EKRANI ─────────────────────────────────────────────────────
function StatsScreen({ data }) {
  const [selMonth,setSM] = useState(monthKey());
  const months6 = getLast6Months(data.transactions);
  const maxVal = Math.max(...months6.map(m=>Math.max(m.income,m.spent)),1);

  const selTxs    = data.transactions.filter(t=>t.month===selMonth);
  const selSpent  = selTxs.filter(t=>t.type==='gider').reduce((a,t)=>a+t.amount,0);
  const selIncome = selTxs.filter(t=>t.type==='gelir').reduce((a,t)=>a+t.amount,0);
  const selCats   = {}; selTxs.filter(t=>t.type==='gider').forEach(t=>{ selCats[t.category]=(selCats[t.category]||0)+t.amount; });
  const catEntries = Object.entries(selCats).sort((a,b)=>b[1]-a[1]);
  const catColors  = [C.accent,C.blue,C.red,C.yellow,C.purple,C.silver,C.orange];

  const bestMonth  = months6.reduce((a,m)=>m.net>a.net?m:a,months6[0]);
  const worstMonth = months6.reduce((a,m)=>m.net<a.net?m:a,months6[0]);
  const avgSpent   = months6.filter(m=>m.spent>0).reduce((a,m)=>a+m.spent,0)/Math.max(months6.filter(m=>m.spent>0).length,1);

  // Insights
  const insights = [];
  const curr=monthKey(); const prevDate=new Date(); prevDate.setMonth(prevDate.getMonth()-1); const prev=monthKey(prevDate);
  const cSpent = data.transactions.filter(t=>t.month===curr&&t.type==='gider').reduce((a,t)=>a+t.amount,0);
  const pSpent = data.transactions.filter(t=>t.month===prev&&t.type==='gider').reduce((a,t)=>a+t.amount,0);
  const cIncome= data.transactions.filter(t=>t.month===curr&&t.type==='gelir').reduce((a,t)=>a+t.amount,0);
  if(pSpent>0){const d=((cSpent-pSpent)/pSpent*100).toFixed(0);const abs=Math.abs(d); if(d>5) insights.push({icon:'📈',text:`Bu ay giderler gecen aya gore %${abs} artti`,color:C.red}); else if(d<-5) insights.push({icon:'📉',text:`Bu ay giderler gecen aya gore %${abs} azaldi`,color:C.green}); else insights.push({icon:'➡️',text:'Giderler gecen ayla benzer',color:C.dim});}
  if(cIncome>0){const r=((cIncome-cSpent)/cIncome*100).toFixed(0);insights.push({icon:'💰',text:`Bu ayki tasarruf orani: %${r}`,color:r>20?C.green:r>0?C.accent:C.red});}
  if(data.budget>0&&cSpent>0){const r=(cSpent/data.budget*100).toFixed(0);if(r>100) insights.push({icon:'⚠️',text:`Butce asimi! Limit %${r-100} gerildi`,color:C.red}); else insights.push({icon:'✅',text:`Butcenin %${r}'si kullanildi`,color:C.accent});}

  const pVal=data.investments.reduce((a,i)=>a+i.current*(i.adet||1),0);
  const pCost=data.investments.reduce((a,i)=>a+i.amount*(i.adet||1),0);
  const pGain=pVal-pCost; const pRate=pCost>0?(pGain/pCost*100).toFixed(1):'0.0';

  return (
    <div style={s.scrollArea}>
      <Card>
        <H title="Akilli Analiz" sub="Bu ay icin otomatik tespitler" />
        {insights.length===0?<div style={{...s.tiny,textAlign:'center',padding:'12px 0'}}>Veri yetersiz — islem girin</div>
          :insights.map((ins,i)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',padding:'8px 0',borderBottom:i<insights.length-1?`1px solid ${C.border}`:'none'}}>
              <span style={{fontSize:18,marginRight:10}}>{ins.icon}</span>
              <span style={{fontSize:13,color:ins.color,fontWeight:600,lineHeight:'18px',flex:1}}>{ins.text}</span>
            </div>
          ))}
      </Card>

      <Card>
        <H title="Son 6 Ay" sub="Gelir & Gider karsilastirmasi" />
        {months6.map((m,i)=>(
          <div key={i} style={{marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{color:C.dim,fontSize:12,fontWeight:600}}>{m.label}</span>
              <span style={{color:m.net>=0?C.accent:C.red,fontSize:12,fontWeight:800}}>{m.net>=0?'+':''}{fmt(m.net)}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',marginBottom:3}}>
              <span style={{width:38,fontSize:9,color:C.accent}}>Gelir</span>
              <div style={{flex:1,height:10,background:C.border,borderRadius:5,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${(m.income/maxVal)*100}%`,background:C.accent,borderRadius:5}} />
              </div>
              <span style={{width:68,fontSize:9,color:C.accent,textAlign:'right'}}>{fmt(m.income)}</span>
            </div>
            <div style={{display:'flex',alignItems:'center'}}>
              <span style={{width:38,fontSize:9,color:C.red}}>Gider</span>
              <div style={{flex:1,height:10,background:C.border,borderRadius:5,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${(m.spent/maxVal)*100}%`,background:C.red,borderRadius:5}} />
              </div>
              <span style={{width:68,fontSize:9,color:C.red,textAlign:'right'}}>{fmt(m.spent)}</span>
            </div>
          </div>
        ))}
      </Card>

      <div style={s.grid2}>
        <Card style={s.half}><span style={s.label}>EN IYI AY</span><div style={{color:C.green,fontWeight:800,fontSize:14}}>{bestMonth?.label||'-'}</div><div style={{...s.tiny,color:C.green}}>{fmt(bestMonth?.net)}</div></Card>
        <Card style={s.half}><span style={s.label}>EN ZOR AY</span><div style={{color:C.red,fontWeight:800,fontSize:14}}>{worstMonth?.label||'-'}</div><div style={{...s.tiny,color:C.red}}>{fmt(worstMonth?.net)}</div></Card>
      </div>

      <Card>
        <H title="Genel Istatistikler" />
        <Row label="6 aylik ort. gider" value={fmt(avgSpent)} color={C.blue} />
        <Row label="Toplam islem" value={`${data.transactions.length}`} color={C.dim} />
        <Row label="Net birikim (6 ay)" value={fmt(months6.reduce((a,m)=>a+m.net,0))} color={months6.reduce((a,m)=>a+m.net,0)>=0?C.accent:C.red} />
      </Card>

      <Card>
        <H title="Ay Bazli Kategori Analizi" />
        <div style={{display:'flex',overflowX:'auto',paddingBottom:8,marginBottom:14}}>
          {months6.map(m=><Chip key={m.key} label={m.label} active={selMonth===m.key} onClick={()=>setSM(m.key)} />)}
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
          <span style={{color:C.accent,fontSize:13,fontWeight:700}}>Gelir: {fmt(selIncome)}</span>
          <span style={{color:C.red,fontSize:13,fontWeight:700}}>Gider: {fmt(selSpent)}</span>
        </div>
        {catEntries.length===0?<div style={{...s.tiny,textAlign:'center',padding:'12px 0'}}>Bu ay icin veri yok</div>
          :catEntries.map(([cat,amt],i)=>(
            <div key={i} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={s.body}>{cat}</span>
                <div style={{textAlign:'right'}}>
                  <div style={{color:catColors[i%7],fontWeight:700,fontSize:13}}>{fmt(amt)}</div>
                  <div style={s.tiny}>%{selSpent>0?((amt/selSpent)*100).toFixed(0):0}</div>
                </div>
              </div>
              <PBar pct={selSpent>0?(amt/selSpent)*100:0} color={catColors[i%7]} />
            </div>
          ))}
      </Card>

      {data.investments.length>0&&(
        <Card>
          <H title="Portfoy Performansi" />
          <Row label="Toplam Deger" value={fmt(pVal)} color={C.text} />
          <Row label="Kar / Zarar" value={`${pGain>=0?'+':''}${fmt(pGain)}`} color={pGain>=0?C.accent:C.red} />
          <Row label="Getiri Orani" value={`${pGain>=0?'+':''}${pRate}%`} color={pGain>=0?C.accent:C.red} />
        </Card>
      )}
    </div>
  );
}

// ─── ASİSTAN EKRANI ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Sen bir kisisel finans asistanisin. Kullanici Turkce yazar, sen de Turkce yanit verirsin.
Her yaniti MUTLAKA su JSON formatinda ver, baska hicbir sey yazma:
{"mesaj":"Kullaniciya aciklama","islem":{"tur":"islem_turu",...}}

Desteklenen islem turleri:
1. Yatirim: {"tur":"yatirim_ekle","tip":"Hisse"|"Kripto"|"Altin"|"Gumus"|"Doviz","sembol":"THYAO","adet":10,"alis_fiyati":"fiyat_cek"}
2. Islem: {"tur":"islem_ekle","tip":"gider"|"gelir","kategori":"Market"|"Kira"|"Faturalar"|"Ulasim"|"Yemek"|"Saglik"|"Giyim"|"Eglence"|"Maas"|"Diger","tutar":250,"not":"aciklama"}
3. Abonelik: {"tur":"abonelik_ekle","isim":"Netflix","tutar":79.99,"gun":15}
4. Borc: {"tur":"borc_ekle","isim":"Ahmet","tutar":500,"tip":"bende"|"bendvar","not":""}
5. Sadece bilgi: {"tur":"bilgi"}

Ornekler:
- "1 adet LOGO hissesi aldim" -> yatirim_ekle, Hisse, LOGO, adet:1, alis_fiyati:"fiyat_cek"
- "Marketten 340 lira harcadim" -> islem_ekle, gider, Market, 340
- "Maasum geldi 50000 lira" -> islem_ekle, gelir, Maas, 50000
- "Portfoyum nasil?" -> bilgi`;

async function callGroq(userMessage, context) {
  const ctx = `Bakiye: ${fmt(context.balance)} TL, Gelir: ${fmt(context.income)} TL, Gider: ${fmt(context.spent)} TL, Portfoy: ${fmt(context.portfolioVal)} TL`;

  // Firebase token al — sunucu bu kullanicinin gercek oldugunu dogrular
  const token = await getIdToken(auth.currentUser, true);

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 512,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + "\n\n" + ctx },
        { role: "user", content: userMessage },
      ],
    }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message || d.error || "Groq API hatasi");
  const text = d.choices?.[0]?.message?.content || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function AssistantScreen({ data, setData }) {
  const [msgs, setMsgs]   = useState([{id:0,role:'assistant',text:'Merhaba! Ben finansal asistanin.\n\nOrnekler:\n"1 adet LOGO hissesi aldim"\n"Marketten 340 lira harcadim"\n"Maasum geldi 50000 lira"\n"0.1 BTC aldim"'}]);
  const [input, setInput] = useState('');
  const [loading, setL]   = useState(false);
  const bottomRef         = useRef(null);


  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}); }, [msgs]);

  const buildCtx = () => {
    const inc = data.transactions.filter(t=>t.type==='gelir').reduce((a,t)=>a+t.amount,0);
    const sp  = data.transactions.filter(t=>t.type==='gider').reduce((a,t)=>a+t.amount,0);
    return { balance:(data.startBalance||0)+inc-sp, income:inc, spent:sp, portfolioVal:data.investments.reduce((a,i)=>a+i.current*(i.adet||1),0) };
  };

  const execAction = async (action, usdTry) => {
    if (!action || action.tur === 'bilgi') return null;
    if (action.tur === 'islem_ekle') {
      setData(d=>({...d,transactions:[{id:Date.now(),type:action.tip,category:action.kategori||'Diger',amount:parseFloat(action.tutar),date:todayStr(),note:action.not||action.kategori,month:monthKey()},...d.transactions]}));
      return `${action.tip==='gelir'?'+':'-'}${fmt(action.tutar)} TL kaydedildi.`;
    }
    if (action.tur === 'yatirim_ekle') {
      let alis = parseFloat(action.alis_fiyati); let guncel = alis; let msg = '';
      if (!alis || action.alis_fiyati === 'fiyat_cek') {
        try { guncel = await getPriceTL(action.tip, action.sembol||'', usdTry); alis = guncel; msg = ` Fiyat otomatik cekildi: ${fmtD(guncel)} TL.`; }
        catch(e) { return `Fiyat cekilemedi: ${e.message}`; }
      } else {
        try { guncel = await getPriceTL(action.tip, action.sembol||'', usdTry); } catch { guncel = alis; }
      }
      const name = action.tip==='Altin'?'Altin (gram)':action.tip==='Gumus'?'Gumus (gram)':(action.sembol||action.tip);
      setData(d=>({...d,investments:[...d.investments,{id:Date.now(),type:action.tip,name,symbol:(action.sembol||'').toUpperCase(),adet:parseFloat(action.adet)||1,amount:alis,current:guncel,change:parseFloat((((guncel-alis)/alis)*100).toFixed(2))}]}));
      return `Portfoya eklendi!${msg}`;
    }
    if (action.tur === 'abonelik_ekle') {
      setData(d=>({...d,subscriptions:[...d.subscriptions,{id:Date.now(),name:action.isim,amount:parseFloat(action.tutar),day:parseInt(action.gun)||1}]}));
      return `${action.isim} aboneligi eklendi.`;
    }
    if (action.tur === 'borc_ekle') {
      setData(d=>({...d,debts:[...(d.debts||[]),{id:Date.now(),name:action.isim,amount:parseFloat(action.tutar),type:action.tip,note:action.not||'',date:todayStr(),paid:false}]}));
      return `${action.isim} icin borc kaydedildi.`;
    }
    return null;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMsgs(m=>[...m,{id:Date.now(),role:'user',text}]);
    setInput('');
    setL(true);
    let usdTry = null;
    try { const r = await fetchRates(); usdTry = r.usdTry; } catch {}
    try {
      const parsed = await callGroq(text, buildCtx());
      const result = await execAction(parsed.islem, usdTry);
      setMsgs(m=>[...m,{id:Date.now()+1,role:'assistant',text:parsed.mesaj+(result?'\n\n'+result:'')}]);
    } catch(e) {
      setMsgs(m=>[...m,{id:Date.now()+1,role:'assistant',text:'Hata: '+e.message,error:true}]);
    }
    setL(false);
  };

  const EXAMPLES = ['1 adet LOGO hissesi aldim','Marketten 350 lira harcadim','Maasum geldi 50000 lira','Benzine 600 TL verdim','Portfoyum nasil?'];

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>


      <div style={{flex:1,overflowY:'auto',padding:16}}>
        {msgs.map(msg=>(
          <div key={msg.id} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start',marginBottom:12}}>
            <div style={{maxWidth:'85%',background:msg.role==='user'?C.accentBg:msg.error?C.redBg:C.card,borderRadius:16,borderBottomRightRadius:msg.role==='user'?4:16,borderBottomLeftRadius:msg.role==='user'?16:4,padding:12,border:`1px solid ${msg.role==='user'?C.accent+'50':msg.error?C.red+'50':C.border}`}}>
              {msg.role==='assistant'&&<div style={{fontSize:10,color:C.accent,fontWeight:700,marginBottom:6}}>AI Asistan</div>}
              <div style={{color:msg.role==='user'?C.accent:C.text,fontSize:14,lineHeight:'20px',whiteSpace:'pre-wrap'}}>{msg.text}</div>
            </div>
          </div>
        ))}
        {loading&&<div style={{display:'flex',marginBottom:12}}>
          <div style={{background:C.card,borderRadius:16,borderBottomLeftRadius:4,padding:14,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:8}}>
            <Spinner size={16}/><span style={{color:C.muted,fontSize:13}}>Dusunuyor...</span>
          </div>
        </div>}
        <div ref={bottomRef} />
      </div>

      <div style={{display:'flex',overflowX:'auto',borderTop:`1px solid ${C.border}`,padding:'8px 12px',gap:8,flexShrink:0}}>
        {EXAMPLES.map((ex,i)=>(
          <button key={i} onClick={()=>setInput(ex)} style={{background:C.border,border:'none',borderRadius:8,padding:'6px 12px',color:C.dim,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
            {ex}
          </button>
        ))}
      </div>

      <div style={{display:'flex',padding:12,paddingBottom:16,background:C.card,borderTop:`1px solid ${C.border}`,gap:10,flexShrink:0}}>
        <input style={{...s.input,flex:1}} placeholder='Yaz... (orn: 5 adet THYAO aldim)'
          value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} />
        <button onClick={send} disabled={loading||!input.trim()} style={{background:loading||!input.trim()?C.border:C.accent,border:'none',borderRadius:12,padding:'0 16px',fontWeight:800,fontSize:16,color:loading||!input.trim()?C.muted:'#0A0E1A',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',gap:6}}>
          {loading?<Spinner size={16}/>:null} Gonder
        </button>
      </div>
    </div>
  );
}

// ─── DAHA FAZLA (Abonelik + Tekrarlayan + Ayarlar) ─────────────────────────
function MoreScreen({ data, setData, user }) {
  const [tab, setTab] = useState('abonelik');
  const TABS = [{id:'abonelik',l:'Abonelik'},{id:'tekrar',l:'Tekrarlayan'},{id:'ayarlar',l:'Ayarlar'}];
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',background:C.card,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:'12px 4px',border:'none',background:'transparent',cursor:'pointer',fontWeight:700,fontSize:13,color:tab===t.id?C.accent:C.muted,borderBottom:`2px solid ${tab===t.id?C.accent:'transparent'}`}}>
            {t.l}
          </button>
        ))}
      </div>
      {tab==='abonelik' && <SubTab data={data} setData={setData} />}
      {tab==='tekrar'   && <RecurTab data={data} setData={setData} />}
      {tab==='ayarlar'  && <SettingsTab data={data} setData={setData} user={user} />}
    </div>
  );
}

function SubTab({ data, setData }) {
  const [name,setN]=useState(''); const [amt,setA]=useState(''); const [day,setD]=useState('');
  const total=data.subscriptions.reduce((a,s)=>a+s.amount,0); const td=new Date().getDate();
  const add = ()=>{ if(!name||!amt) return; setData(d=>({...d,subscriptions:[...d.subscriptions,{id:Date.now(),name,amount:parseFloat(amt),day:parseInt(day)||1}]})); setN('');setA('');setD(''); };
  const del = id=>setData(d=>({...d,subscriptions:d.subscriptions.filter(s=>s.id!==id)}));
  const upcoming=[...data.subscriptions].filter(s=>s.day>=td).sort((a,b)=>a.day-b.day);
  return (
    <div style={s.scrollArea}>
      <Card style={{background:C.purpleBg,borderColor:'#4c1d95'}}>
        <span style={s.label}>AYLIK ABONELIK</span>
        <div style={{fontSize:32,fontWeight:900,color:C.purple,margin:'4px 0'}}>{fmt(total)}</div>
        <div style={{display:'flex',justifyContent:'space-between'}}>
          <span style={s.tiny}>Yillik: {fmt(total*12)}</span>
          <span style={s.tiny}>Gunluk: {fmt(total/30)}</span>
        </div>
      </Card>
      {upcoming.length>0&&<Card style={{borderColor:'#4c1d95'}}><H title="Bu Ay Bekleyen" />{upcoming.map(s=>{const dl=s.day-td;return <div key={s.id} style={s.txRow}><div style={{flex:1}}><div style={s.body}>{s.name}</div><div style={{...s.tiny,color:dl<=3?C.red:C.muted}}>{dl===0?'Bugun!':`${dl} gun sonra`}</div></div><span style={{fontWeight:800,color:C.purple}}>{fmt(s.amount)}</span></div>;})}</Card>}
      <Card><H title="Tum Abonelikler" />{data.subscriptions.length===0?<div style={{...s.tiny,textAlign:'center',padding:'12px 0'}}>Abonelik yok</div>:data.subscriptions.map(s=><div key={s.id} style={s.txRow}><div style={{flex:1}}><div style={s.body}>{s.name}</div><div style={s.tiny}>Her ayin {s.day}. gunu</div></div><span style={{fontWeight:800,color:C.purple,marginRight:10}}>{fmt(s.amount)}</span><button onClick={()=>del(s.id)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:16}}>X</button></div>)}</Card>
      <Card><H title="Abonelik Ekle" />
        <input style={{...s.input,marginBottom:8}} placeholder="Servis adi (Netflix)" value={name} onChange={e=>setN(e.target.value)} />
        <input style={{...s.input,marginBottom:8}} placeholder="Aylik tutar (TL)" type="number" value={amt} onChange={e=>setA(e.target.value)} />
        <input style={{...s.input,marginBottom:8}} placeholder="Odeme gunu (1-31)" type="number" value={day} onChange={e=>setD(e.target.value)} />
        <button onClick={add} style={{...s.btn,background:C.purple}}>+ Ekle</button>
      </Card>
    </div>
  );
}

function RecurTab({ data, setData }) {
  const [rName,setRN]=useState(''); const [rAmt,setRA]=useState(''); const [rType,setRT]=useState('gider'); const [rCat,setRC]=useState('Maas'); const [rDay,setRD]=useState('1');
  const add = ()=>{ if(!rName||!rAmt) return; setData(d=>({...d,recurring:[...(d.recurring||[]),{id:Date.now(),name:rName,amount:parseFloat(rAmt),type:rType,category:rCat,day:parseInt(rDay)||1}]})); setRN('');setRA('');setRD('1'); };
  const del = id=>setData(d=>({...d,recurring:d.recurring.filter(r=>r.id!==id)}));
  return (
    <div style={s.scrollArea}>
      <Card><H title="Tekrarlayan Islemler" sub="Her ay otomatik eklenir" />
        {(!data.recurring||data.recurring.length===0)?<div style={{...s.tiny,textAlign:'center',padding:'12px 0'}}>Tekrarlayan islem yok</div>
          :data.recurring.map(r=><div key={r.id} style={s.txRow}><div style={{flex:1}}><div style={s.body}>{r.name}</div><div style={s.tiny}>{r.category} — Her ayin {r.day}. gunu</div></div><span style={{fontWeight:700,color:r.type==='gelir'?C.accent:C.red,marginRight:10}}>{r.type==='gelir'?'+':'-'}{fmt(r.amount)}</span><button onClick={()=>del(r.id)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:16}}>X</button></div>)}
      </Card>
      <Card><H title="Yeni Tekrarlayan Ekle" />
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          {['gider','gelir'].map(t=><button key={t} onClick={()=>setRT(t)} style={{flex:1,padding:10,border:'none',borderRadius:10,cursor:'pointer',fontWeight:700,background:rType===t?(t==='gelir'?C.accent:C.red):C.border,color:rType===t?'#0A0E1A':C.muted}}>{t==='gelir'?'+ Gelir':'- Gider'}</button>)}
        </div>
        <div style={{display:'flex',overflowX:'auto',paddingBottom:8,marginBottom:8}}>{TX_CATS.map(c=><Chip key={c} label={c} active={rCat===c} onClick={()=>setRC(c)} />)}</div>
        <input style={{...s.input,marginBottom:8}} placeholder="Islem adi (Maas, Kira)" value={rName} onChange={e=>setRN(e.target.value)} />
        <input style={{...s.input,marginBottom:8}} placeholder="Tutar (TL)" type="number" value={rAmt} onChange={e=>setRA(e.target.value)} />
        <input style={{...s.input,marginBottom:8}} placeholder="Hangi gun (1-31)" type="number" value={rDay} onChange={e=>setRD(e.target.value)} />
        <button onClick={add} style={s.btn}>+ Ekle</button>
      </Card>
    </div>
  );
}

function SettingsTab({ data, setData, user }) {
  const resetAll = ()=>{ if(confirm('Tum veriler silinecek! Emin misiniz?')) { setData({...INIT}); alert('Veriler temizlendi.'); } };
  const exportCSV = ()=>{
    let csv='Tarih,Tur,Kategori,Tutar,Not\n';
    data.transactions.forEach(t=>{ csv+=`${t.date},${t.type},${t.category},${t.amount},"${(t.note||'').replace(/"/g,'')}"\n`; });
    const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='butce.csv'; a.click();
  };
  return (
    <div style={s.scrollArea}>
      {/* Kullanici */}
      <Card style={{borderColor:C.accentBg}}>
        <H title="Hesap" />
        <Row label="Email" value={user?.email||'-'} />
        <Row label="Ad" value={user?.displayName||'Anonim'} />
        <button onClick={()=>signOut(auth)} style={{...s.btn,background:C.border,color:C.dim,marginTop:12}}>Cikis Yap</button>
      </Card>



      {/* Export */}
      <Card>
        <H title="Veri Disa Aktarimi" />
        <div style={{...s.tiny,marginBottom:12}}>Islemler CSV olarak indirilir. Toplam {data.transactions.length} islem.</div>
        <button onClick={exportCSV} style={{...s.btn,background:C.green,color:'#0A0E1A'}}>CSV Olarak Indir</button>
      </Card>

      {/* Hakkinda */}
      <Card>
        <H title="Uygulama Hakkinda" />
        <Row label="Versiyon" value="Web 1.0" />
        <Row label="Toplam islem" value={`${data.transactions.length}`} />
        <Row label="Toplam varlik" value={`${data.investments.length}`} />
        <Row label="Borc kaydi" value={`${(data.debts||[]).length}`} />
      </Card>

      {/* Reset */}
      <Card style={{borderColor:C.red}}>
        <H title="Tehlikeli Bolge" />
        <button onClick={resetAll} style={{...s.btn,background:C.redBg,border:`1px solid ${C.red}`,color:C.red}}>Tum Verileri Sifirla</button>
      </Card>
    </div>
  );
}

// ─── DUYURULAR HOOK ────────────────────────────────────────────────────────
function useAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  useEffect(() => {
    const q = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, snap => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);
  return announcements;
}

// ─── DUYURU KARTI ──────────────────────────────────────────────────────────
function AnnouncementCard({ ann }) {
  const tipConfig = {
    info:       { color: C.blue,   bg: C.blueBg,   icon: 'ℹ️' },
    uyari:      { color: C.yellow, bg: C.yellowBg,  icon: '⚠️' },
    guncelleme: { color: C.accent, bg: C.accentBg,  icon: '🆕' },
    haber:      { color: C.purple, bg: C.purpleBg,  icon: '📰' },
    sistem:     { color: C.orange, bg: '#1c0a00',   icon: '🔔' },
  };
  const cfg = tipConfig[ann.tip] || tipConfig.info;
  const tarih = ann.createdAt?.toDate?.()?.toLocaleDateString('tr-TR') || '';
  return (
    <div style={{background:cfg.bg, border:`1px solid ${cfg.color}40`, borderRadius:12, padding:12, marginBottom:8}}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
        <span style={{fontSize:14}}>{cfg.icon}</span>
        <span style={{fontWeight:700,fontSize:13,color:cfg.color,flex:1}}>{ann.baslik}</span>
        <span style={{fontSize:10,color:C.muted}}>{tarih}</span>
      </div>
      <div style={{fontSize:12,color:C.dim,lineHeight:'17px'}}>{ann.icerik}</div>
      {ann.kaynak && <div style={{fontSize:10,color:cfg.color,marginTop:4}}>Kaynak: {ann.kaynak}</div>}
    </div>
  );
}

// ─── ADMİN EKRANI ──────────────────────────────────────────────────────────
function AdminScreen({ user }) {
  const [msgs, setMsgs]       = useState([{id:0, role:'admin', text:'Merhaba Burak! Yonetici asistanin hazir.\n\nOrnekler:\n"Bugun dolar haberi paylasimi yap"\n"Guncel haberleri cek ve paylasimi yap"\n"Yeni ozellik hakkinda duyuru olustur"\n"Kullanicilara bütce uyarisi gonder"'}]);
  const [input, setInput]     = useState('');
  const [loading, setL]       = useState(false);
  const [annList, setAnnList] = useState([]);
  const [stats, setStats]     = useState(null);
  const bottomRef             = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}); }, [msgs]);

  // Duyurulari getir
  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt','desc'), limit(10));
    const unsub = onSnapshot(q, snap => {
      setAnnList(snap.docs.map(d => ({id:d.id,...d.data()})));
    });
    return unsub;
  }, []);

  // Kullanici istatistikleri
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        setStats({ userCount: usersSnap.size });
      } catch {}
    };
    fetchStats();
  }, []);

  const deleteAnn = async (id) => {
    if (!confirm('Bu duyuruyu sil?')) return;
    await deleteDoc(doc(db, 'announcements', id));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMsgs(m => [...m, {id:Date.now(), role:'user', text}]);
    setInput('');
    setL(true);
    try {
      const token = await getIdToken(auth.currentUser, true);
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
        body: JSON.stringify({ command: text }),
      });
      const parsed = await res.json();
      if (parsed.error) throw new Error(parsed.error);

      // Duyuru veya haber ise Firestore'a kaydet
      if (['duyuru','haber','sistem'].includes(parsed.tur)) {
        await addDoc(collection(db, 'announcements'), {
          baslik: parsed.baslik,
          icerik: parsed.icerik,
          tip: parsed.tur === 'haber' ? 'haber' : parsed.tip || parsed.tur,
          kaynak: parsed.kaynak || null,
          createdAt: serverTimestamp(),
        });
        setMsgs(m => [...m, {id:Date.now()+1, role:'admin',
          text: `✅ Yayinlandi! "${parsed.baslik}" — tum kullanicilar gorecek.`}]);
      } else {
        setMsgs(m => [...m, {id:Date.now()+1, role:'admin', text: parsed.mesaj || JSON.stringify(parsed)}]);
      }
    } catch(e) {
      setMsgs(m => [...m, {id:Date.now()+1, role:'admin', text:'Hata: '+e.message, error:true}]);
    }
    setL(false);
  };

  const QUICK_CMDS = [
    'Son dakika ekonomi haberlerini cek ve paylasim yap',
    'Yeni ozellik eklendi duyurusu olustur',
    'Kullanicilara butce uyarisi gonder',
    'Dolar kuru hakkinda bilgi ver',
    'Sistem bakimi hakkinda uyari olustur',
  ];

  const tipLabel = { info:'Bilgi', uyari:'Uyari', guncelleme:'Guncelleme', haber:'Haber', sistem:'Sistem' };
  const tipColor = { info:C.blue, uyari:C.yellow, guncelleme:C.accent, haber:C.purple, sistem:C.orange };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>

      {/* Admin header */}
      <div style={{background:'#0D0A1A',borderBottom:`1px solid ${C.purple}40`,padding:'10px 16px',flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:4,background:C.purple}}/>
            <span style={{fontWeight:800,fontSize:13,color:C.purple}}>YONETICI PANELI</span>
          </div>
          {stats && <span style={{fontSize:11,color:C.muted}}>{stats.userCount} kullanici</span>}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>

        {/* Istatistik kartlari */}
        <div style={{padding:'12px 16px 0',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <div style={{background:C.purpleBg,border:`1px solid ${C.purple}40`,borderRadius:12,padding:12}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:'1px'}}>KULLANICI</div>
            <div style={{fontSize:24,fontWeight:900,color:C.purple}}>{stats?.userCount || '-'}</div>
          </div>
          <div style={{background:C.accentBg,border:`1px solid ${C.accent}40`,borderRadius:12,padding:12}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:'1px'}}>DUYURU</div>
            <div style={{fontSize:24,fontWeight:900,color:C.accent}}>{annList.length}</div>
          </div>
        </div>

        {/* Yayinlanan duyurular */}
        {annList.length > 0 && (
          <div style={{padding:'12px 16px 0'}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:8,letterSpacing:'1px'}}>YAYINDA</div>
            {annList.map(ann => (
              <div key={ann.id} style={{display:'flex',alignItems:'center',gap:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 12px',marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:tipColor[ann.tip]||C.text}}>{ann.baslik}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>
                    {tipLabel[ann.tip]||ann.tip} — {ann.createdAt?.toDate?.()?.toLocaleDateString('tr-TR')||''}
                  </div>
                </div>
                <button onClick={()=>deleteAnn(ann.id)}
                  style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:16,padding:4}}>
                  X
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Chat */}
        <div style={{flex:1,padding:'12px 16px'}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:8,letterSpacing:'1px'}}>ASISTAN</div>
          {msgs.map(msg => (
            <div key={msg.id} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start',marginBottom:10}}>
              <div style={{maxWidth:'88%',background:msg.role==='user'?'#1a0d2e':msg.error?C.redBg:C.card,
                borderRadius:14,borderBottomRightRadius:msg.role==='user'?3:14,borderBottomLeftRadius:msg.role==='user'?14:3,
                padding:'10px 12px',border:`1px solid ${msg.role==='user'?C.purple+'60':msg.error?C.red+'50':C.border}`}}>
                {msg.role==='admin'&&<div style={{fontSize:9,color:C.purple,fontWeight:700,marginBottom:4}}>YONETİCİ AI</div>}
                <div style={{color:msg.role==='user'?C.purple:C.text,fontSize:13,lineHeight:'19px',whiteSpace:'pre-wrap'}}>{msg.text}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{display:'flex',marginBottom:10}}>
              <div style={{background:C.card,borderRadius:14,borderBottomLeftRadius:3,padding:12,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:8}}>
                <Spinner size={14} color={C.purple}/><span style={{color:C.muted,fontSize:12}}>Isliyor...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
      </div>

      {/* Hizli komutlar */}
      <div style={{display:'flex',overflowX:'auto',borderTop:`1px solid ${C.border}`,padding:'8px 12px',gap:8,flexShrink:0}}>
        {QUICK_CMDS.map((cmd,i)=>(
          <button key={i} onClick={()=>setInput(cmd)}
            style={{background:'#1a0d2e',border:`1px solid ${C.purple}40`,borderRadius:8,padding:'6px 12px',
              color:C.purple,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
            {cmd}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{display:'flex',padding:12,paddingBottom:16,background:C.card,borderTop:`1px solid ${C.border}`,gap:10,flexShrink:0}}>
        <input style={{...s.input,flex:1}} placeholder="Komut ver... (orn: bugun dolar haberi paylasimi yap)"
          value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} />
        <button onClick={send} disabled={loading||!input.trim()}
          style={{background:loading||!input.trim()?C.border:C.purple,border:'none',borderRadius:12,
            padding:'0 16px',fontWeight:800,color:loading||!input.trim()?C.muted:'#fff',
            cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',gap:6}}>
          {loading?<Spinner size={16} color={C.purple}/>:null} Gonder
        </button>
      </div>
    </div>
  );
}

// ─── HABER FEED EKRANI ─────────────────────────────────────────────────────
function NewsFeedScreen() {
  const [cards, setCards]     = useState([]);
  const [idx, setIdx]         = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipeDir, setSwipe]  = useState(null); // 'left' | 'right' | 'up' | 'down'
  const [saved, setSaved]     = useState([]);
  const [showSaved, setShowS] = useState(false);
  const [drag, setDrag]       = useState({ x: 0, y: 0, dragging: false });
  const startRef              = useRef(null);
  const cardRef               = useRef(null);

  // Firestore'dan haberleri çek
  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCards(docs);
      setLoading(false);
    });
    return unsub;
  }, []);

  const current = cards[idx];
  const progress = cards.length ? ((idx) / cards.length) * 100 : 0;

  const tipCfg = {
    haber:      { color: C.purple, bg: '#0f0a1f', icon: '📰', label: 'Haber' },
    info:       { color: C.blue,   bg: '#070d1f', icon: 'ℹ️',  label: 'Bilgi' },
    uyari:      { color: C.yellow, bg: '#100e00', icon: '⚠️',  label: 'Uyarı' },
    guncelleme: { color: C.accent, bg: '#041510', icon: '🆕',  label: 'Güncelleme' },
    sistem:     { color: C.orange, bg: '#120600', icon: '🔔',  label: 'Sistem' },
  };

  const goNext = (dir) => {
    if (idx >= cards.length - 1) return;
    setSwipe(dir || 'up');
    setTimeout(() => { setIdx(i => i + 1); setSwipe(null); setDrag({ x:0, y:0, dragging:false }); dragRef.current = {x:0,y:0}; }, 280);
  };
  const goPrev = () => {
    if (idx === 0) return;
    setSwipe('down');
    setTimeout(() => { setIdx(i => i - 1); setSwipe(null); setDrag({ x:0, y:0, dragging:false }); dragRef.current = {x:0,y:0}; }, 280);
  };
  const saveCard = () => {
    if (current && !saved.find(s => s.id === current.id)) setSaved(s => [...s, current]);
    goNext('right');
  };
  const skipCard = () => goNext('left');

  // Touch handlers — dragRef ile closure sorununu coz
  const dragRef = useRef({ x: 0, y: 0 });

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    dragRef.current = { x: 0, y: 0 };
    setDrag({ x: 0, y: 0, dragging: true });
  };
  const onTouchMove = (e) => {
    if (!startRef.current) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    dragRef.current = { x: dx, y: dy };
    setDrag({ x: dx, y: dy, dragging: true });
  };
  const onTouchEnd = () => {
    // dragRef kullan, eski state'i okuma
    const { x, y } = dragRef.current;
    const threshold = 55;
    if (Math.abs(x) > Math.abs(y)) {
      if (x > threshold) saveCard();
      else if (x < -threshold) skipCard();
      else { setDrag({ x:0, y:0, dragging:false }); dragRef.current={x:0,y:0}; }
    } else {
      if (y < -threshold) goNext('up');
      else if (y > threshold) goPrev();
      else { setDrag({ x:0, y:0, dragging:false }); dragRef.current={x:0,y:0}; }
    }
    startRef.current = null;
  };

  // Keyboard support
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') goNext('up');
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx, cards.length]);

  // Kaydedilenler ekranı
  if (showSaved) {
    return (
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:'#0D0A1A',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <button onClick={()=>setShowS(false)} style={{background:'none',border:'none',color:C.accent,fontSize:20,cursor:'pointer'}}>←</button>
          <span style={{fontWeight:800,fontSize:14,color:C.text}}>Kaydedilenler ({saved.length})</span>
        </div>
        <div style={s.scrollArea}>
          {saved.length === 0
            ? <div style={{textAlign:'center',padding:'40px 16px',color:C.muted}}>Henuz kaydettigin haber yok.<br/>Haberleri saga kaydirarak kaydet.</div>
            : saved.map((ann,i) => {
                const cfg = tipCfg[ann.tip] || tipCfg.info;
                return (
                  <div key={i} style={{background:cfg.bg,border:`1px solid ${cfg.color}40`,borderRadius:14,padding:16,marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                      <span style={{fontSize:18}}>{cfg.icon}</span>
                      <span style={{fontWeight:800,fontSize:13,color:cfg.color,flex:1}}>{ann.baslik}</span>
                    </div>
                    <div style={{fontSize:13,color:C.dim,lineHeight:'19px',marginBottom:6}}>{ann.icerik}</div>
                    {ann.analiz && <div style={{fontSize:12,color:cfg.color,background:`${cfg.color}15`,borderRadius:8,padding:'6px 10px',marginTop:6}}>💡 {ann.analiz}</div>}
                    {ann.etiket && <div style={{fontSize:11,fontWeight:700,color:cfg.color,marginTop:6}}>{ann.etiket}</div>}
                    <button onClick={()=>setSaved(s=>s.filter((_,j)=>j!==i))}
                      style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 10px',color:C.muted,fontSize:11,cursor:'pointer',marginTop:8}}>
                      Kaldir
                    </button>
                  </div>
                );
              })
          }
        </div>
      </div>
    );
  }

  if (loading) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',gap:12}}>
      <Spinner size={36}/>
      <span style={{color:C.muted,fontSize:13}}>Haberler yukleniyor...</span>
    </div>
  );

  if (cards.length === 0) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',padding:32,textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:12}}>📭</div>
      <div style={{color:C.text,fontWeight:700,fontSize:16,marginBottom:8}}>Henuz haber yok</div>
      <div style={{color:C.muted,fontSize:13}}>Bot yakininda otomatik haber paylasmaya baslayacak.</div>
    </div>
  );

  if (idx >= cards.length) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',padding:32,textAlign:'center'}}>
      <div style={{fontSize:56,marginBottom:16}}>🎉</div>
      <div style={{color:C.text,fontWeight:800,fontSize:18,marginBottom:8}}>Hepsini okudun!</div>
      <div style={{color:C.muted,fontSize:13,marginBottom:24}}>Bugun icin tum haberler bu kadar.</div>
      <button onClick={()=>setIdx(0)} style={{...s.btn,width:'auto',padding:'12px 32px'}}>Bastan Baslat</button>
      {saved.length > 0 && (
        <button onClick={()=>setShowS(true)} style={{...s.btnSec,width:'auto',padding:'12px 32px',marginTop:0}}>
          Kaydedilenleri Gor ({saved.length})
        </button>
      )}
    </div>
  );

  const cfg = tipCfg[current?.tip] || tipCfg.info;

  // Swipe animasyonu
  const cardStyle = (() => {
    if (swipeDir === 'left')  return { transform:'translateX(-120%) rotate(-15deg)', opacity:0, transition:'all 0.28s ease' };
    if (swipeDir === 'right') return { transform:'translateX(120%) rotate(15deg)',  opacity:0, transition:'all 0.28s ease' };
    if (swipeDir === 'up')    return { transform:'translateY(-110%)', opacity:0, transition:'all 0.28s ease' };
    if (swipeDir === 'down')  return { transform:'translateY(110%)',  opacity:0, transition:'all 0.28s ease' };
    if (drag.dragging && (Math.abs(drag.x) > 5 || Math.abs(drag.y) > 5)) {
      const rot = drag.x * 0.08;
      return { transform:`translate(${drag.x}px, ${drag.y}px) rotate(${rot}deg)`, transition:'none' };
    }
    return { transform:'translateX(0) rotate(0deg) translateY(0)', opacity:1, transition:'all 0.2s ease' };
  })();

  // Sürükleme rengi ipucu
  const swipeHint = drag.dragging
    ? drag.x > 40  ? { label:'KAYDET', color:C.accent, opacity: Math.min(Math.abs(drag.x)/80,1) }
    : drag.x < -40 ? { label:'GEC',    color:C.red,    opacity: Math.min(Math.abs(drag.x)/80,1) }
    : drag.y < -40 ? { label:'SONRAKI',color:C.blue,   opacity: Math.min(Math.abs(drag.y)/80,1) }
    : drag.y > 40  ? { label:'ONCEKI', color:C.yellow,  opacity: Math.min(Math.abs(drag.y)/80,1) }
    : null : null;

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:cfg.bg,transition:'background 0.4s'}}>
      {/* Üst bar */}
      <div style={{padding:'12px 16px 8px',flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:14}}>{cfg.icon}</span>
            <span style={{fontSize:11,fontWeight:700,color:cfg.color,letterSpacing:'1px'}}>{cfg.label?.toUpperCase()}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:11,color:C.muted}}>{idx+1} / {cards.length}</span>
            {saved.length > 0 && (
              <button onClick={()=>setShowS(true)}
                style={{background:C.accentBg,border:`1px solid ${C.accent}40`,borderRadius:20,padding:'4px 10px',color:C.accent,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                🔖 {saved.length}
              </button>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{height:3,background:'#ffffff10',borderRadius:2,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${progress}%`,background:cfg.color,borderRadius:2,transition:'width 0.3s'}}/>
        </div>
      </div>

      {/* Kart alanı */}
      <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'8px 16px',position:'relative',overflow:'hidden', touchAction:'none'}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

        {/* Swipe hint overlay */}
        {swipeHint && (
          <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
            fontSize:28,fontWeight:900,color:swipeHint.color,opacity:swipeHint.opacity,
            border:`3px solid ${swipeHint.color}`,borderRadius:12,padding:'8px 20px',
            pointerEvents:'none',zIndex:10,letterSpacing:2}}>
            {swipeHint.label}
          </div>
        )}

        {/* Sonraki kart (arka planda) */}
        {cards[idx+1] && (
          <div style={{position:'absolute',inset:'8px 20px',borderRadius:24,
            background:(tipCfg[cards[idx+1]?.tip]||tipCfg.info).bg,
            border:`1px solid ${(tipCfg[cards[idx+1]?.tip]||tipCfg.info).color}30`,
            transform:'scale(0.94) translateY(12px)',zIndex:0}}>
          </div>
        )}

        {/* Ana kart */}
        <div ref={cardRef} style={{position:'relative',zIndex:1,background:`${cfg.bg}`,
          border:`1px solid ${cfg.color}50`,borderRadius:24,padding:24,
          boxShadow:`0 20px 60px ${cfg.color}20`,userSelect:'none',cursor:'grab',...cardStyle}}>

          {/* Tarih */}
          <div style={{fontSize:10,color:C.muted,marginBottom:16,letterSpacing:'1px'}}>
            {current?.createdAt?.toDate?.()?.toLocaleDateString('tr-TR',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}) || ''}
          </div>

          {/* Başlık */}
          <div style={{fontSize:20,fontWeight:900,color:C.text,lineHeight:'26px',marginBottom:14}}>
            {current?.baslik}
          </div>

          {/* İçerik */}
          <div style={{fontSize:14,color:C.dim,lineHeight:'22px',marginBottom:16}}>
            {current?.icerik}
          </div>

          {/* AI analizi */}
          {current?.analiz && (
            <div style={{background:`${cfg.color}12`,border:`1px solid ${cfg.color}30`,borderRadius:14,padding:14,marginBottom:14}}>
              <div style={{fontSize:10,color:cfg.color,fontWeight:700,letterSpacing:'1px',marginBottom:6}}>💡 AI ANALİZİ</div>
              <div style={{fontSize:13,color:cfg.color,lineHeight:'19px'}}>{current.analiz}</div>
            </div>
          )}

          {/* Etiket */}
          {current?.etiket && (
            <div style={{display:'inline-block',background:`${cfg.color}20`,borderRadius:20,
              padding:'6px 14px',fontSize:13,fontWeight:700,color:cfg.color}}>
              {current.etiket}
            </div>
          )}

          {/* Kaynak */}
          {current?.kaynak && (
            <div style={{fontSize:11,color:C.muted,marginTop:10}}>Kaynak: {current.kaynak}</div>
          )}
        </div>
      </div>

      {/* Swipe butonları */}
      <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:20,padding:'12px 16px 20px',flexShrink:0}}>
        <button onClick={goPrev} disabled={idx===0}
          style={{width:48,height:48,borderRadius:24,background:idx===0?'#111':'#1c1400',border:`2px solid ${idx===0?C.border:C.yellow}`,
            display:'flex',alignItems:'center',justifyContent:'center',cursor:idx===0?'default':'pointer',fontSize:20,opacity:idx===0?0.3:1}}>
          ↑
        </button>
        <button onClick={skipCard}
          style={{width:58,height:58,borderRadius:29,background:C.redBg,border:`2px solid ${C.red}`,
            display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:24}}>
          ✕
        </button>
        <button onClick={saveCard}
          style={{width:58,height:58,borderRadius:29,background:C.accentBg,border:`2px solid ${C.accent}`,
            display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:22}}>
          🔖
        </button>
        <button onClick={()=>goNext('up')} disabled={idx>=cards.length-1}
          style={{width:48,height:48,borderRadius:24,background:idx>=cards.length-1?'#111':'#070d1f',
            border:`2px solid ${idx>=cards.length-1?C.border:C.blue}`,
            display:'flex',alignItems:'center',justifyContent:'center',cursor:idx>=cards.length-1?'default':'pointer',fontSize:20,opacity:idx>=cards.length-1?0.3:1}}>
          ↓
        </button>
      </div>

      {/* Swipe ipucu (ilk kart) */}
      {idx === 0 && cards.length > 0 && (
        <div style={{textAlign:'center',paddingBottom:8,flexShrink:0}}>
          <span style={{fontSize:11,color:C.muted}}>← Geç  |  Yukarı/Aşağı Kaydır  |  Kaydet →</span>
        </div>
      )}
    </div>
  );
}

// ─── ANA UYGULAMA ──────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]     = useState(undefined);
  const [tab, setTab]       = useState('home');
  const { data, setData, loading } = useUserData(user?.uid);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u || null));
    return unsub;
  }, []);

  // Tekrarlayan islemleri uygula
  useEffect(() => {
    if (!data) return;
    const curr = monthKey(); const todayDay = new Date().getDate();
    let txs = [...data.transactions]; let changed = false;
    (data.recurring||[]).forEach(r => {
      if(r.day > todayDay) return;
      if(!txs.some(t=>t.recurringId===r.id && t.month===curr)) {
        txs.unshift({id:Date.now()+Math.random(),type:r.type,category:r.category,amount:r.amount,date:todayStr(),note:`${r.name} (Otomatik)`,month:curr,recurringId:r.id});
        changed=true;
      }
    });
    if(changed) setData(d=>({...d,transactions:txs}));
  }, [data?.recurring]);

  if (user === undefined || (user && loading)) {
    return (
      <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100dvh',background:C.bg,flexDirection:'column',gap:12}}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Spinner size={40} />
        <span style={{color:C.muted,fontSize:13}}>Yukleniyor...</span>
      </div>
    );
  }

  if (!user) return <><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><AuthScreen /></>;
  if (!data) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100dvh',background:C.bg}}><Spinner size={40}/></div>;

  const income = data.transactions.filter(t=>t.type==='gelir').reduce((a,t)=>a+t.amount,0);
  const spent  = data.transactions.filter(t=>t.type==='gider').reduce((a,t)=>a+t.amount,0);
  const bal    = (data.startBalance||0)+income-spent;
  const bPct   = data.budget?(spent/data.budget)*100:0;

  const isAdmin = user?.uid === ADMIN_UID;

  const TABS = [
    {id:'home',   icon:'◉', label:'Genel'},
    {id:'news',   icon:'📰', label:'Haberler'},
    {id:'budget', icon:'₺', label:'Butce'},
    {id:'invest', icon:'↑', label:'Yatirim'},
    {id:'stats',  icon:'▦', label:'Analiz'},
    {id:'ai',     icon:'✦', label:'Asistan'},
    {id:'more',   icon:'⋯', label:'Daha'},
  ];

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} * {-webkit-tap-highlight-color:transparent}`}</style>
      <div style={s.app}>
        {/* Header */}
        <div style={s.header}>
          {/* Uygulama basligi ve gelistirici */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:18}}>₺</span>
              <span style={{fontSize:13,fontWeight:800,color:C.text,letterSpacing:0.5}}>Butce Takip</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              {isAdmin && (
                <button onClick={()=>setTab('admin')}
                  style={{background:tab==='admin'?C.purpleBg:'#1a0d2e',border:`1px solid ${tab==='admin'?C.purple:C.purple+'50'}`,borderRadius:20,padding:'4px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:6,height:6,borderRadius:3,background:C.purple}}/>
                  <span style={{fontSize:10,fontWeight:700,color:C.purple}}>Admin</span>
                </button>
              )}
              <div style={{display:'flex',alignItems:'center',gap:6,background:'#ffffff08',borderRadius:20,padding:'4px 10px',border:`1px solid ${C.border}`}}>
                <div style={{width:6,height:6,borderRadius:3,background:C.accent}}/>
                <span style={{fontSize:10,color:C.muted}}>by </span>
                <span style={{fontSize:10,fontWeight:700,color:C.accent}}>Burak Gundogdu</span>
              </div>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <span style={s.label}>TOPLAM BAKIYE</span>
              <div style={{fontSize:28,fontWeight:900,color:C.text,letterSpacing:-1}}>{fmt(bal)}</div>
              <div style={{...s.tiny,marginTop:2}}>+{fmt(income)} gelir  —  -{fmt(spent)} gider</div>
            </div>
            {bPct>80&&data.budget>0&&(
              <div style={{background:C.redBg,borderRadius:10,padding:8,border:`1px solid ${C.red}`,textAlign:'center'}}>
                <div style={{color:C.red,fontSize:9,fontWeight:700}}>BUTCE</div>
                <div style={{color:C.red,fontSize:20,fontWeight:900}}>%{bPct.toFixed(0)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Ekranlar */}
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {tab==='home'   && <HomeScreen   data={data} setData={setData} user={user} />}
          {tab==='news'   && <NewsFeedScreen />}
          {tab==='budget' && <BudgetScreen data={data} setData={setData} />}
          {tab==='invest' && <InvestmentScreen data={data} setData={setData} />}
          {tab==='stats'  && <StatsScreen  data={data} />}
          {tab==='ai'     && <AssistantScreen data={data} setData={setData} />}
          {tab==='more'   && <MoreScreen   data={data} setData={setData} user={user} />}
          {tab==='admin'  && isAdmin && <AdminScreen user={user} />}
        </div>

        {/* Alt nav */}
        <div style={s.nav}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{...s.navBtn, background:tab===t.id?C.accentBg+'70':'transparent', borderRadius:10, margin:'0 2px'}}>
              <span style={{fontSize:16,color:tab===t.id?C.accent:C.muted}}>{t.icon}</span>
              <span style={{fontSize:9,fontWeight:700,color:tab===t.id?C.accent:C.muted}}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}