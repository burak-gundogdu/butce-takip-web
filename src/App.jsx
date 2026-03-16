import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, getIdToken,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, onSnapshot, updateDoc,
  collection, addDoc, deleteDoc, getDocs, query, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';

// ─── ADMIN ─────────────────────────────────────────────────────────────────
const ADMIN_UID = 'kHtyEx0LG8VPuEYkj2JPNFZPRy12';

// ─── TEMA ──────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg:'#0A0E1A', card:'#111827', border:'#1F2937',
    accent:'#6EE7B7', accentBg:'#065F46',
    red:'#F87171', redBg:'#2d0a0a',
    yellow:'#FCD34D', yellowBg:'#1c1400',
    blue:'#60A5FA', blueBg:'#0c1f3d',
    purple:'#A78BFA', purpleBg:'#1a0d2e',
    text:'#F9FAFB', muted:'#6B7280', dim:'#9CA3AF',
    silver:'#CBD5E1', silverBg:'#0d1421',
    green:'#4ade80', orange:'#FB923C',
    headerBg:'#0D1B2A',
  },
  light: {
    bg:'#F1F5F9', card:'#FFFFFF', border:'#E2E8F0',
    accent:'#059669', accentBg:'#D1FAE5',
    red:'#EF4444', redBg:'#FEE2E2',
    yellow:'#D97706', yellowBg:'#FEF3C7',
    blue:'#2563EB', blueBg:'#DBEAFE',
    purple:'#7C3AED', purpleBg:'#EDE9FE',
    text:'#0F172A', muted:'#64748B', dim:'#475569',
    silver:'#64748B', silverBg:'#F8FAFC',
    green:'#16A34A', orange:'#EA580C',
    headerBg:'#FFFFFF',
  },
};
let C = THEMES.dark;

// ─── DİL ───────────────────────────────────────────────────────────────────
const LANGS = {
  tr: {
    genel:'Genel', haberler:'Haberler', hisseler:'Hisseler', butce:'Butce',
    yatirim:'Yatirim', analiz:'Analiz', asistan:'Asistan', daha:'Daha',
    bakiye:'TOPLAM BAKİYE', portfoy:'Portfoy', guncelle:'Guncelle',
    ekle:'Ekle', sil:'Sil', kaydet:'Kaydet', iptal:'Iptal',
    gelir:'Gelir', gider:'Gider', net:'Net',
    canliKurlar:'Canli Kurlar', bistEndeksleri:'BIST ENDEKSLERİ',
    haberYok:'Haber yok', yukselenler:'Yukselenler', dusenler:'Dusenler',
    favoriler:'Favoriler', tumHisseler:'Tum Hisseler',
    fiyatGuncelle:'Fiyat Guncelle', yorumYap:'Yorum Yap',
    haberiOku:'Haberin Tamamini Oku', aiAnalizi:'AI ANALİZİ',
    bildirimler:'Bildirimler', temaSec:'Tema Sec', dilSec:'Dil Sec',
    karanlik:'Karanlik', aydinlik:'Aydinlik',
    turkce:'Turkce', ingilizce:'Ingilizce',
    alarm:'Fiyat Alarmi', alarmEkle:'Alarm Ekle', alarmYok:'Alarm yok',
    kripto:'Kripto',
    hedefFiyat:'Hedef Fiyat', ust:'Uste Cikarsa', alt:'Alta Duserse',
    cikisYap:'Cikis Yap', hesap:'Hesap',
    toplamlBakiye:'TOPLAM BAKİYE', portfoyDegeri:'Portfoy Degeri',
    aylikButce:'Aylik Butce', tasarrufHedefleri:'Tasarruf Hedefleri',
    borcTakibi:'Borc Takibi', islemEkle:'Islem Ekle', tumIslemler:'Tum Islemler',
    hizliEkle:'Hizli Ekle', butceYok:'Henuz islem yok',
    canliKurlarBaslik:'Canli Kurlar', sonIslemler:'Son Islemler',
    yatirimEkle:'Yatirim Ekle', portfoyDagilimi:'Portfoy Dagilimi',
    tumPortfoyu:'Tum Portfoyu Guncelle', fiyatCek:'Fiyat Cek',
    aktifGun:'Son 6 Ay', akillıAnaliz:'Akilli Analiz',
    kategoriAnaliz:'Kategori Analizi',
  },
  en: {
    genel:'Home', haberler:'News', hisseler:'Stocks', butce:'Budget',
    yatirim:'Portfolio', analiz:'Analytics', asistan:'Assistant', daha:'More',
    bakiye:'TOTAL BALANCE', portfoy:'Portfolio', guncelle:'Refresh',
    ekle:'Add', sil:'Delete', kaydet:'Save', iptal:'Cancel',
    gelir:'Income', gider:'Expense', net:'Net',
    canliKurlar:'Live Rates', bistEndeksleri:'BIST INDICES',
    haberYok:'No news', yukselenler:'Gainers', dusenler:'Losers',
    favoriler:'Favorites', tumHisseler:'All Stocks',
    fiyatGuncelle:'Refresh Prices', yorumYap:'Comment',
    haberiOku:'Read Full Article', aiAnalizi:'AI ANALYSIS',
    bildirimler:'Notifications', temaSec:'Select Theme', dilSec:'Select Language',
    karanlik:'Dark', aydinlik:'Light',
    turkce:'Turkish', ingilizce:'English',
    alarm:'Price Alert', alarmEkle:'Add Alert', alarmYok:'No alerts',
    kripto:'Crypto',
    toplamlBakiye:'TOTAL BALANCE', portfoyDegeri:'Portfolio Value',
    aylikButce:'Monthly Budget', tasarrufHedefleri:'Savings Goals',
    borcTakibi:'Debt Tracker', islemEkle:'Add Transaction', tumIslemler:'All Transactions',
    hizliEkle:'Quick Add', butceYok:'No transactions yet',
    canliKurlarBaslik:'Live Rates', sonIslemler:'Recent Transactions',
    yatirimEkle:'Add Investment', portfoyDagilimi:'Portfolio Breakdown',
    tumPortfoyu:'Update All', fiyatCek:'Get Price',
    aktifGun:'Last 6 Months', akillıAnaliz:'Smart Analysis',
    kategoriAnaliz:'Category Analysis',
    hedefFiyat:'Target Price', ust:'If rises above', alt:'If falls below',
    cikisYap:'Sign Out', hesap:'Account',
  },
};
let T = LANGS.tr;

const TROY = 31.1035;
const INIT = {
  startBalance: 0, transactions: [], investments: [],
  subscriptions: [], goals: [], budget: 0,
  debts: [], recurring: [],
  settings: { groqKey: '', theme: 'dark', lang: 'tr', favStocks: [], priceAlerts: [] },
};

// ─── STİLLER - CSS var() kullanarak tema değişince otomatik güncellenir ──
// Getter fonksiyonları ile dinamik stil - C değişince yeni değeri okur
const gs = () => ({
  app:      { display:'flex', flexDirection:'column', height:'100dvh', background:C.bg, maxWidth:480, margin:'0 auto', position:'relative', overflow:'hidden' },
  header:   { padding:'16px 20px 12px', background:C.card, flexShrink:0 },
  scrollArea:{ flex:1, overflowY:'auto', padding:16, paddingBottom:24, background:C.bg, height:'100%', width:'100%', minHeight:0 },
  card:     { background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:16, marginBottom:12 },
  half:     { background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:14, flex:1 },
  grid2:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 },
  btn:      { background:C.accent, border:'none', borderRadius:12, padding:'14px 20px', cursor:'pointer', fontWeight:800, fontSize:14, color:'#0A0E1A', width:'100%', marginTop:10 },
  btnSec:   { background:C.border, border:'none', borderRadius:12, padding:'14px 20px', cursor:'pointer', fontWeight:700, fontSize:14, color:C.dim, width:'100%', marginTop:10 },
  input:    { background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px', color:C.text, fontSize:14, width:'100%', marginBottom:0 },
  label:    { fontSize:10, color:C.muted, letterSpacing:'1.5px', marginBottom:4, display:'block' },
  title:    { fontSize:15, fontWeight:700, color:C.text },
  tiny:     { fontSize:11, color:C.muted, marginTop:2 },
  body:     { fontSize:13, fontWeight:600, color:C.text },
  bigN:     { fontSize:20, fontWeight:800, color:C.text },
  nav:      { display:'flex', background:C.card, borderTop:`1px solid ${C.border}`, flexShrink:0 },
  navBtn:   { flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 4px 20px', cursor:'pointer', gap:2, border:'none', background:'transparent' },
  chip:     { display:'inline-block', padding:'7px 12px', borderRadius:8, cursor:'pointer', marginRight:6, marginBottom:4, fontWeight:600, fontSize:12, flexShrink:0 },
  row:      { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:`1px solid ${C.border}` },
  txRow:    { display:'flex', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.border}` },
});
// s proxy - her erişimde güncel C değerlerini okur
const s = new Proxy({}, { get: (_, k) => gs()[k] || {} });

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
const CRYPTO_CG_IDS = {
  BTC:'bitcoin', ETH:'ethereum', BNB:'binancecoin', SOL:'solana',
  XRP:'ripple', ADA:'cardano', AVAX:'avalanche-2', DOGE:'dogecoin',
  DOT:'polkadot', MATIC:'matic-network', LINK:'chainlink', UNI:'uniswap',
  LTC:'litecoin', ATOM:'cosmos', XLM:'stellar', TRX:'tron', NEAR:'near',
  ALGO:'algorand', VET:'vechain', FIL:'filecoin', SHIB:'shiba-inu',
};

async function getCryptoUSD(sym) {
  // Önce Yahoo dene
  try {
    const ticker = sym.includes('-') ? sym : `${sym}-USD`;
    const p = await yahooPrice(ticker);
    if (p && p > 0) return p;
  } catch {}
  // CoinGecko fallback
  const cgId = CRYPTO_CG_IDS[sym.toUpperCase()];
  if (!cgId) throw new Error(`${sym} desteklenmiyor`);
  const r = await fetch(`/api/prices`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ tickers: [`${sym.toUpperCase()}-USD`] }),
  });
  const d = await r.json();
  const p = d.prices?.[`${sym.toUpperCase()}-USD`]?.price;
  if (p && p > 0) return p;
  throw new Error(`${sym} fiyat alinamadi`);
}

async function getPriceTL(type, symbol, usdTry) {
  if (type === 'Hisse') {
    const ticker = symbol.includes('.') ? symbol : `${symbol}.IS`;
    const p = await yahooPrice(ticker);
    if (!p) throw new Error(`${symbol} bulunamadi`);
    return p;
  }
  if (type === 'Kripto') {
    const rate = usdTry || 34;
    const usdPrice = await getCryptoUSD(symbol);
    return usdPrice * rate;
  }
  if (type === 'Altin') {
    const p = await yahooPrice('GC=F');
    if (!p) throw new Error('Altin bulunamadi');
    return (p / TROY) * (usdTry || 34);
  }
  if (type === 'Gumus') {
    const p = await yahooPrice('SI=F');
    if (!p) throw new Error('Gumus bulunamadi');
    return (p / TROY) * (usdTry || 34);
  }
  if (type === 'Doviz') {
    const p = await yahooPrice(`${symbol.toUpperCase()}TRY=X`);
    if (!p) throw new Error('Kur bulunamadi');
    return p;
  }
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
    <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',height:'100dvh',background:C.bg,padding:24,color:C.text}}>
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
              {m === 'login' ? (T.lang === 'en' ? 'Sign In' : 'Giris Yap') : (T.lang === 'en' ? 'Sign Up' : 'Kayit Ol')}
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
  const [rates, setRates]     = useState(null);
  const [metals, setMetals]   = useState(null);
  const [indices, setIndices] = useState(null);
  const [rLoad, setRL]        = useState(true);
  const [rErr, setRE]         = useState(null);
  const [editBal, setEB]      = useState(false);
  const [balIn, setBI]        = useState('');
  const [dismissed, setDism]  = useState(new Set()); // Session-only, her acilista sifirlanir

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
      const [g,sv,xu100,xu050,xu030,katilim] = await Promise.all([
        yahooPrice('GC=F'), yahooPrice('SI=F'),
        yahooPrice('XU100.IS'), yahooPrice('XU050.IS'),
        yahooPrice('XU030.IS'), yahooPrice('XKTUM.IS'),
      ]);
      setMetals({ goldGram: g?(g/TROY)*r.usdTry:null, silverGram: sv?(sv/TROY)*r.usdTry:null, goldUSD:g, silverUSD:sv });
      if (xu100) setIndices({ bist100:xu100, bist50:xu050, bist30:xu030, katilim });
    } catch(e) { setRE(e.message); }
    setRL(false);
  }, []);

  useEffect(() => { loadRates(); }, []);

  return (
    <div style={s.scrollArea}>
      {/* Admin duyurulari - session icinde kapatilabilir, her acilista geri gelir */}
      {announcements.filter(a => a.tip !== 'haber' && !dismissed.has(a.id)).length > 0 && (
        <div style={{marginBottom:4}}>
          {announcements.filter(a => a.tip !== 'haber' && !dismissed.has(a.id)).map(ann => (
            <AnnouncementCard key={ann.id} ann={ann} onDismiss={id => setDism(d => new Set([...d, id]))} />
          ))}
        </div>
      )}
      {/* Bakiye */}
      <Card style={{background:'#0D1B2A', borderColor:C.accentBg}}>
        <span style={s.label}>{T.toplamlBakiye||'TOPLAM BAKİYE'}</span>
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
          <H title={T.canliKurlarBaslik||"Canli Kurlar"} sub="Yahoo Finance" />
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
        {/* BIST Endeksleri */}
        {indices && (
          <div style={{marginTop:12}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:700,letterSpacing:'1px',marginBottom:8}}>BIST ENDEKSLERİ</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[
                {label:'BIST 100', val:indices.bist100, color:C.blue},
                {label:'BIST 50',  val:indices.bist50,  color:C.purple},
                {label:'BIST 30',  val:indices.bist30,  color:C.accent},
                {label:'Katilim',  val:indices.katilim, color:C.yellow},
              ].map(idx => idx.val && (
                <div key={idx.label} style={{background:`${idx.color}12`,border:`1px solid ${idx.color}40`,borderRadius:12,padding:10}}>
                  <div style={{fontSize:10,color:idx.color,fontWeight:700}}>{idx.label}</div>
                  <div style={{fontSize:16,fontWeight:900,color:C.text}}>{fmtD(idx.val,0)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Son islemler */}
      <Card>
        <H title={T.sonIslemler||"Son Islemler"} />
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
    const a = parseFloat(alis);
    const c = parseFloat(cur) || a;
    const ad = parseFloat(adet) || 1;
    const sym = symbol.toUpperCase().trim();

    setData(d => {
      const invs = d.investments || [];
      // Aynı tipte ve sembolde varlık var mı? (case-insensitive)
      const existing = invs.find(i => {
        if (i.type !== itype) return false;
        if (itype === 'Altin' || itype === 'Gumus') return true; // Altın/Gümüş hep birleştir
        if (!sym) return false;
        return (i.symbol || '').toUpperCase().trim() === sym;
      });

      if (existing) {
        const oldAdet = existing.adet || 1;
        const newAdet = oldAdet + ad;
        const avgCost = ((existing.amount * oldAdet) + (a * ad)) / newAdet;
        const chg = parseFloat((((c - avgCost) / avgCost) * 100).toFixed(2));
        return {
          ...d,
          investments: invs.map(i =>
            i.id === existing.id
              ? { ...i, adet: newAdet, amount: avgCost, current: c, change: chg }
              : i
          ),
        };
      }

      // Yeni ekle
      return {
        ...d,
        investments: [...invs, {
          id: Date.now(),
          type: itype,
          name,
          symbol: sym,
          adet: ad,
          amount: a,
          current: c,
          change: parseFloat((((c - a) / a) * 100).toFixed(2)),
        }],
      };
    });

    setSym(''); setAdet(''); setAlis(''); setCur('');
  };
  const del = id => setData(d=>({...d,investments:d.investments.filter(i=>i.id!==id)}));

  // Aynı sembol/tip yatırımları birleştir
  const mergeDuplicates = () => {
    setData(d => {
      const merged = {};
      const order = [];
      d.investments.forEach(inv => {
        const key = inv.type==='Altin'||inv.type==='Gumus'
          ? inv.type
          : `${inv.type}_${inv.symbol||inv.name}`;
        if (!merged[key]) {
          merged[key] = {...inv};
          order.push(key);
        } else {
          const ex = merged[key];
          const totalAdet = (ex.adet||1) + (inv.adet||1);
          const avgCost = ((ex.amount*(ex.adet||1)) + (inv.amount*(inv.adet||1))) / totalAdet;
          merged[key] = {
            ...ex,
            adet: totalAdet,
            amount: avgCost,
            current: inv.current || ex.current,
            change: parseFloat((((inv.current||ex.current) - avgCost) / avgCost * 100).toFixed(2)),
          };
        }
      });
      return {...d, investments: order.map(k => merged[k])};
    });
    alert('Aynı varlıklar birleştirildi!');
  };

  return (
    <div style={s.scrollArea}>
      <Card style={{background:C.card,borderColor:C.accentBg}}>
        <span style={s.label}>TOPLAM PORTFOY</span>
        <div style={{fontSize:32,fontWeight:900,color:C.text,marginBottom:4}}>{fmt(totalVal)}</div>
        <div style={{color:gain>=0?C.accent:C.red,fontWeight:700,fontSize:15,marginBottom:4}}>{gain>=0?'+':''}{fmt(gain)}  ({gain>=0?'+':''}{gainPct}%)</div>
        <Row label="Toplam Maliyet" value={fmt(totalCost)} />
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button onClick={bulkUpdate} style={{...s.btn,flex:1,background:C.accentBg,border:`1px solid ${C.accent}`,color:C.accent,marginTop:0,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            {bulkUpd?<Spinner size={16}/>:null} Guncelle
          </button>
          <button onClick={mergeDuplicates} style={{...s.btn,flex:1,background:C.blueBg,border:`1px solid ${C.blue}`,color:C.blue,marginTop:0}}>
            🔗 Birleştir
          </button>
        </div>
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
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
      <div style={{display:'flex',background:C.card,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:'12px 4px',border:'none',background:'transparent',cursor:'pointer',fontWeight:700,fontSize:13,color:tab===t.id?C.accent:C.muted,borderBottom:`2px solid ${tab===t.id?C.accent:'transparent'}`}}>
            {t.l}
          </button>
        ))}
      </div>
      {/* minHeight:0 + flex:1 mobilde içeriğin görünmesini sağlar */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0}}>
        {tab==='abonelik' && <SubTab data={data} setData={setData} />}
        {tab==='tekrar'   && <RecurTab data={data} setData={setData} />}
        {tab==='ayarlar'  && <SettingsTab data={data} setData={setData} user={user} />}
      </div>
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
  const theme   = data.settings?.theme || 'dark';
  const lang    = data.settings?.lang  || 'tr';
  const alerts  = data.settings?.priceAlerts || [];
  const [alCode, setAC]   = useState('');
  const [alPrice, setAP]  = useState('');
  const [alDir, setAD]    = useState('ust');
  
  // GÜVENLİ BİLDİRİM KONTROLÜ EKLENDİ (Mobil çökmesini engeller)
  const safeNotif = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  const [notifPerm, setNP] = useState(safeNotif);

  const setTheme = (t) => setData(d => ({...d, settings:{...d.settings, theme:t}}));
  const setLang  = (l) => setData(d => ({...d, settings:{...d.settings, lang:l}}));

  const addAlert = () => {
    if (!alCode || !alPrice) return;
    const newAlerts = [...alerts, {id:Date.now(), code:alCode.toUpperCase(), price:parseFloat(alPrice), dir:alDir, active:true}];
    setData(d => ({...d, settings:{...d.settings, priceAlerts:newAlerts}}));
    setAC(''); setAP('');
  };
  const delAlert = (id) => setData(d => ({...d, settings:{...d.settings, priceAlerts:alerts.filter(a=>a.id!==id)}}));

  const requestNotif = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return alert('Tarayici bildirim desteklemiyor');
    const p = await Notification.requestPermission();
    setNP(p);
    if (p === 'granted') {
      new Notification('Butce Takip', { body: 'Bildirimler aktif!', icon: '/icon-192.png' });
    }
  };

  const installPWA = () => {
    if (window._pwaPrompt) { window._pwaPrompt.prompt(); }
    else alert('Tarayici menusunden "Ana Ekrana Ekle" yi sec');
  };

  const resetAll = ()=>{ if(window.confirm('Tum veriler silinecek!')) { setData({...INIT}); } };
  const exportCSV = ()=>{
    let csv='Tarih,Tur,Kategori,Tutar,Not\n';
    data.transactions.forEach(t=>{ csv+=`${t.date},${t.type},${t.category},${t.amount},"${(t.note||'').replace(/"/g,'')}"\n`; });
    const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='butce.csv'; a.click();
  };

  return (
    <div style={{...s.scrollArea, height:'100%', width:'100%', minHeight:0}}>
      {/* Hesap */}
      <Card style={{borderColor:C.accentBg}}>
        <H title={T.hesap} />
        <Row label="Email" value={user?.email||'-'} />
        <Row label="Ad" value={user?.displayName||'Anonim'} />
        <button onClick={()=>signOut(auth)} style={{...s.btn,background:C.border,color:C.dim,marginTop:12}}>{T.cikisYap}</button>
      </Card>

      {/* Tema */}
      <Card>
        <H title={T.temaSec} />
        <div style={{display:'flex',gap:10}}>
          {[['dark','🌙 '+T.karanlik],['light','☀️ '+T.aydinlik]].map(([t,l])=>(
            <button key={t} onClick={()=>setTheme(t)}
              style={{flex:1,padding:12,border:`2px solid ${theme===t?C.accent:C.border}`,borderRadius:12,
                background:theme===t?C.accentBg:'transparent',color:theme===t?C.accent:C.muted,
                cursor:'pointer',fontWeight:700,fontSize:13}}>
              {l}
            </button>
          ))}
        </div>
      </Card>

      {/* Dil */}
      <Card>
        <H title={T.dilSec} />
        <div style={{display:'flex',gap:10}}>
          {[['tr','🇹🇷 '+T.turkce],['en','🇬🇧 '+T.ingilizce]].map(([l,label])=>(
            <button key={l} onClick={()=>setLang(l)}
              style={{flex:1,padding:12,border:`2px solid ${lang===l?C.blue:C.border}`,borderRadius:12,
                background:lang===l?C.blueBg:'transparent',color:lang===l?C.blue:C.muted,
                cursor:'pointer',fontWeight:700,fontSize:13}}>
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Bildirimler + PWA */}
      <Card>
        <H title={T.bildirimler} />
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div>
            <div style={s.body}>Tarayici Bildirimleri</div>
            <div style={{...s.tiny,color:notifPerm==='granted'?C.green:C.muted}}>
              {notifPerm==='granted'?'Aktif ✓':notifPerm==='denied'?'Engellendi':'İzin verilmedi'}
            </div>
          </div>
          {notifPerm !== 'granted' && (
            <button onClick={requestNotif}
              style={{background:C.accentBg,border:`1px solid ${C.accent}`,borderRadius:10,
                padding:'8px 14px',color:C.accent,fontSize:12,fontWeight:700,cursor:'pointer'}}>
              İzin Ver
            </button>
          )}
        </div>
        <button onClick={installPWA}
          style={{...s.btn,background:C.blueBg,border:`1px solid ${C.blue}`,color:C.blue}}>
          📱 Ana Ekrana Ekle (PWA)
        </button>
      </Card>

      {/* Fiyat Alarmları */}
      <Card>
        <H title={T.alarm} sub="Hisse fiyati hedefe ulasinca bildir" />
        {alerts.length === 0
          ? <div style={{...s.tiny,textAlign:'center',padding:'12px 0'}}>{T.alarmYok}</div>
          : alerts.map(a => (
            <div key={a.id} style={{...s.txRow}}>
              <div style={{flex:1}}>
                <div style={s.body}>{a.code}</div>
                <div style={s.tiny}>{a.dir==='ust'?'↑ Uste':'↓ Alta'} {fmtD(a.price)} ₺</div>
              </div>
              <button onClick={()=>delAlert(a.id)}
                style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:18}}>×</button>
            </div>
          ))
        }
        <div style={{marginTop:12}}>
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            {['ust','alt'].map(d=>(
              <button key={d} onClick={()=>setAD(d)}
                style={{flex:1,padding:8,border:'none',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:12,
                  background:alDir===d?C.accent:C.border,color:alDir===d?'#0A0E1A':C.muted}}>
                {d==='ust'?'↑ Uste Cikarsa':'↓ Alta Duserse'}
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <input style={{...s.input,flex:1}} placeholder="Hisse (THYAO)" value={alCode} onChange={e=>setAC(e.target.value)}/>
            <input style={{...s.input,flex:1}} placeholder="Fiyat (₺)" type="number" value={alPrice} onChange={e=>setAP(e.target.value)}/>
          </div>
          <button onClick={addAlert} style={{...s.btn,background:C.yellow,color:'#0A0E1A',marginTop:8}}>{T.alarmEkle}</button>
        </div>
      </Card>

      {/* Export */}
      <Card>
        <H title="Veri Disa Aktarimi" />
        <div style={{...s.tiny,marginBottom:12}}>{data.transactions.length} islem CSV olarak indirilir.</div>
        <button onClick={exportCSV} style={{...s.btn,background:C.green,color:'#0A0E1A'}}>CSV Olarak Indir</button>
      </Card>

      {/* Hakkinda */}
      <Card>
        <H title="Uygulama Hakkinda" />
        <Row label="Versiyon" value="Web 2.0" />
        <Row label="Toplam islem" value={`${data.transactions.length}`} />
        <Row label="Varlik" value={`${data.investments.length}`} />
        <Row label="Borc" value={`${(data.debts||[]).length}`} />
        <Row label="Fiyat alarmi" value={`${alerts.length}`} />
      </Card>

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
    // Sadece admin duyurulari — haber tipi degil
    // Bot haberleri bu querye girmiyor, limit sorunu yok
    const q = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAnnouncements(all.filter(a => a.tip !== 'haber'));
    });
    return unsub;
  }, []);
  return announcements;
}

// ─── DUYURU KARTI - swipe to dismiss ───────────────────────────────────────
function AnnouncementCard({ ann, onDismiss }) {
  const [drag, setDrag]     = useState(0);
  const [gone, setGone]     = useState(false);
  const startX              = useRef(null);
  const tipConfig = {
    info:       { color: C.blue,   bg: C.blueBg,   icon: 'ℹ️' },
    uyari:      { color: C.yellow, bg: C.yellowBg,  icon: '⚠️' },
    guncelleme: { color: C.accent, bg: C.accentBg,  icon: '🆕' },
    sistem:     { color: C.orange, bg: '#1c0a00',   icon: '🔔' },
  };
  const cfg = tipConfig[ann.tip] || tipConfig.info;
  const tarih = ann.createdAt?.toDate?.()?.toLocaleDateString('tr-TR') || '';

  const onTS = (e) => { startX.current = e.touches[0].clientX; };
  const onTM = (e) => {
    if (startX.current === null) return;
    setDrag(e.touches[0].clientX - startX.current);
  };
  const onTE = () => {
    if (Math.abs(drag) > 80) {
      setGone(true);
      setTimeout(() => onDismiss?.(ann.id), 300);
    } else {
      setDrag(0);
    }
    startX.current = null;
  };

  if (gone) return null;

  const opacity = Math.max(0, 1 - Math.abs(drag) / 150);
  const hint = drag > 40 ? '→ Kapat' : drag < -40 ? 'Kapat ←' : null;

  return (
    <div style={{position:'relative',marginBottom:8,overflow:'hidden',borderRadius:12}}>
      {hint && (
        <div style={{position:'absolute',top:'50%',transform:'translateY(-50%)',
          [drag>0?'left':'right']:12,color:cfg.color,fontSize:11,fontWeight:700,opacity:Math.min(Math.abs(drag)/80,1)}}>
          {hint}
        </div>
      )}
      <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
        style={{background:cfg.bg, border:`1px solid ${cfg.color}40`, borderRadius:12, padding:12,
          transform:`translateX(${drag}px)`, opacity, transition: drag===0?'all 0.3s':'none',
          cursor:'grab'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
          <span style={{fontSize:14}}>{cfg.icon}</span>
          <span style={{fontWeight:700,fontSize:13,color:cfg.color,flex:1}}>{ann.baslik}</span>
          <span style={{fontSize:10,color:C.muted}}>{tarih}</span>
        </div>
        <div style={{fontSize:12,color:C.dim,lineHeight:'17px'}}>{ann.icerik}</div>
        <div style={{...s.tiny,color:C.muted,marginTop:4}}>← Sola/Saga kaydirarak kapat</div>
      </div>
    </div>
  );
}

// ─── ADMİN EKRANI ──────────────────────────────────────────────────────────
function AdminScreen({ user }) {
  const [tab, setTab]       = useState('asistan');
  const [msgs, setMsgs]     = useState([{id:0,role:'admin',text:'Merhaba Burak! Yonetici panelindesin.\n\nOrnekler:\n"Yeni ozellik duyurusu olustur"\n"Kullanicilara altin uyarisi gonder"\n"Son dakika ekonomi haberi paylasimi yap"\n"Uygulama bakimda uyarisi olustur"'}]);
  const [input, setInput]   = useState('');
  const [loading, setL]     = useState(false);
  const [annList, setAnnL]  = useState([]);
  const [stats, setStats]   = useState(null);
  const [manBaslik,setMB]   = useState('');
  const [manIcerik,setMI]   = useState('');
  const [manTip,setMT]      = useState('info');
  const bottomRef           = useRef(null);
  const ADMIN_TABS = [{id:'asistan',l:'AI Asistan'},{id:'duyurular',l:'Yayinda'},{id:'manuel',l:'Manuel'},{id:'istatistik',l:'Istatistik'}];

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[msgs]);

  useEffect(()=>{
    const q = query(collection(db,'announcements'),orderBy('createdAt','desc'),limit(100));
    return onSnapshot(q, snap=>setAnnL(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[]);

  useEffect(()=>{
    getDocs(collection(db,'users')).then(snap=>{
      const users = snap.docs.map(d=>d.id);
      // Her kullanicinin islem sayisini topla
      Promise.all(users.map(uid=>
        getDocs(collection(db,'users',uid,'data')).then(s=>s.size).catch(()=>0)
      )).then(counts=>{
        setStats({
          userCount: snap.size,
          haberCount: annList.filter(a=>a.tip==='haber').length,
          duyuruCount: annList.filter(a=>a.tip!=='haber').length,
        });
      });
    }).catch(()=>{});
  },[annList]);

  const deleteAnn = async(id)=>{ if(!confirm('Sil?')) return; await deleteDoc(doc(db,'announcements',id)); };

  const manuelEkle = async()=>{
    if(!manBaslik||!manIcerik) return alert('Baslik ve icerik gerekli');
    await addDoc(collection(db,'announcements'),{
      baslik:manBaslik, icerik:manIcerik, tip:manTip,
      kaynak:null, createdAt:serverTimestamp()
    });
    setMB(''); setMI('');
    alert('Duyuru yayinlandi!');
  };

  const send = async()=>{
    const text=input.trim(); if(!text||loading) return;
    setMsgs(m=>[...m,{id:Date.now(),role:'user',text}]); setInput(''); setL(true);
    try {
      const token = await getIdToken(auth.currentUser,true);
      const res = await fetch('/api/admin',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body:JSON.stringify({command:text}),
      });
      const parsed = await res.json();
      if(parsed.error) throw new Error(parsed.error);
      if(['duyuru','haber','sistem'].includes(parsed.tur)){
        await addDoc(collection(db,'announcements'),{
          baslik: parsed.baslik,
          icerik: parsed.icerik,
          tip: parsed.tur==='haber'?'haber':(parsed.tip||parsed.tur),
          kaynak: parsed.kaynak||null,
          createdAt: serverTimestamp(),
        });
        setMsgs(m=>[...m,{id:Date.now()+1,role:'admin',text:`✅ Yayinlandi!\n"${parsed.baslik}"\nTum kullanicilar gorecek.`}]);
      } else {
        setMsgs(m=>[...m,{id:Date.now()+1,role:'admin',text:parsed.mesaj||'Tamam.'}]);
      }
    } catch(e){
      setMsgs(m=>[...m,{id:Date.now()+1,role:'admin',text:'Hata: '+e.message,error:true}]);
    }
    setL(false);
  };

  const tipRenk = {info:C.blue,uyari:C.yellow,guncelleme:C.accent,haber:C.purple,sistem:C.orange};
  const tipAdi  = {info:'Bilgi',uyari:'Uyari',guncelleme:'Guncelleme',haber:'Haber',sistem:'Sistem'};
  const QUICK = ['Yeni ozellik eklendi duyurusu olustur','Altin fiyati yurekse uyari gonder','Kullanicilara butce ipucu ver','Uygulama guncelleme duyurusu','Dolar kuru hakkinda piyasa analizi'];

  const duyurular = annList.filter(a=>a.tip!=='haber');
  const haberler  = annList.filter(a=>a.tip==='haber');

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      {/* Header */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.purple}40`,padding:'10px 16px 0',flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:4,background:C.purple,boxShadow:`0 0 8px ${C.purple}`}}/>
            <span style={{fontWeight:900,fontSize:13,color:C.purple,letterSpacing:'1px'}}>ADMIN PANEL</span>
          </div>
          <div style={{display:'flex',gap:8}}>
            <span style={{fontSize:11,background:C.purpleBg,border:`1px solid ${C.purple}40`,borderRadius:20,padding:'3px 10px',color:C.purple}}>{stats?.userCount||0} kullanici</span>
            <span style={{fontSize:11,background:C.accentBg,border:`1px solid ${C.accent}40`,borderRadius:20,padding:'3px 10px',color:C.accent}}>{duyurular.length} duyuru</span>
          </div>
        </div>
        {/* Sub tabs */}
        <div style={{display:'flex',gap:0}}>
          {ADMIN_TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{flex:1,padding:'8px 4px',border:'none',background:'transparent',cursor:'pointer',
                fontWeight:700,fontSize:11,color:tab===t.id?C.purple:C.muted,
                borderBottom:`2px solid ${tab===t.id?C.purple:'transparent'}`,transition:'all 0.2s'}}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* AI ASISTAN TAB */}
      {tab==='asistan' && (
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{flex:1,overflowY:'auto',padding:14}}>
            {msgs.map(msg=>(
              <div key={msg.id} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start',marginBottom:10}}>
                <div style={{maxWidth:'88%',background:msg.role==='user'?'#1a0d2e':msg.error?C.redBg:C.card,
                  borderRadius:14,borderBottomRightRadius:msg.role==='user'?3:14,borderBottomLeftRadius:msg.role==='user'?14:3,
                  padding:'10px 12px',border:`1px solid ${msg.role==='user'?C.purple+'60':msg.error?C.red+'50':C.border}`}}>
                  {msg.role==='admin'&&<div style={{fontSize:9,color:C.purple,fontWeight:700,marginBottom:4}}>AI ASISTAN</div>}
                  <div style={{color:msg.role==='user'?C.purple:C.text,fontSize:13,lineHeight:'19px',whiteSpace:'pre-wrap'}}>{msg.text}</div>
                </div>
              </div>
            ))}
            {loading&&<div style={{display:'flex',marginBottom:10}}>
              <div style={{background:C.card,borderRadius:14,borderBottomLeftRadius:3,padding:12,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:8}}>
                <Spinner size={14} color={C.purple}/><span style={{color:C.muted,fontSize:12}}>Isliyor...</span>
              </div>
            </div>}
            <div ref={bottomRef}/>
          </div>
          <div style={{display:'flex',overflowX:'auto',padding:'8px 12px',gap:8,borderTop:`1px solid ${C.border}`,flexShrink:0}}>
            {QUICK.map((q,i)=>(
              <button key={i} onClick={()=>setInput(q)}
                style={{background:'#1a0d2e',border:`1px solid ${C.purple}40`,borderRadius:8,padding:'6px 12px',
                  color:C.purple,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{q}</button>
            ))}
          </div>
          <div style={{display:'flex',padding:12,paddingBottom:16,background:C.card,borderTop:`1px solid ${C.border}`,gap:10,flexShrink:0}}>
            <input style={{...s.input,flex:1}} placeholder="Komut ver..."
              value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}/>
            <button onClick={send} disabled={loading||!input.trim()}
              style={{background:loading||!input.trim()?C.border:C.purple,border:'none',borderRadius:12,
                padding:'0 16px',fontWeight:800,color:loading||!input.trim()?C.muted:'#fff',
                cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',gap:6}}>
              {loading?<Spinner size={16} color={C.purple}/>:null} Gonder
            </button>
          </div>
        </div>
      )}

      {/* YAYINDA TAB */}
      {tab==='duyurular' && (
        <div style={s.scrollArea}>
          {duyurular.length===0&&haberler.length===0 && <div style={{...s.tiny,textAlign:'center',padding:'24px 0'}}>Hic yayinlanmis icerik yok</div>}
          {duyurular.length>0&&<>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:'1px',marginBottom:8}}>DUYURULAR ({duyurular.length})</div>
            {duyurular.map(ann=>(
              <div key={ann.id} style={{display:'flex',alignItems:'flex-start',gap:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:tipRenk[ann.tip]||C.text}}>{ann.baslik}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{tipAdi[ann.tip]||ann.tip} — {ann.createdAt?.toDate?.()?.toLocaleDateString('tr-TR')||''}</div>
                  <div style={{fontSize:11,color:C.dim,marginTop:4}}>{ann.icerik?.slice(0,80)}...</div>
                </div>
                <button onClick={()=>deleteAnn(ann.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:18,padding:'0 4px'}}>×</button>
              </div>
            ))}
          </>}
          {haberler.length>0&&<>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:'1px',marginBottom:8,marginTop:12}}>HABERLER ({haberler.length})</div>
            {haberler.map(ann=>(
              <div key={ann.id} style={{display:'flex',alignItems:'flex-start',gap:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px',marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.purple}}>{ann.baslik}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ann.kaynak||'Bot'} — {ann.createdAt?.toDate?.()?.toLocaleDateString('tr-TR')||''}</div>
                </div>
                <button onClick={()=>deleteAnn(ann.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:18,padding:'0 4px'}}>×</button>
              </div>
            ))}
          </>}
        </div>
      )}

      {/* MANUEL DUYURU TAB */}
      {tab==='manuel' && (
        <div style={s.scrollArea}>
          <Card style={{borderColor:C.purple}}>
            <H title="Manuel Duyuru Olustur" sub="AI olmadan direkt yayinla"/>
            <div style={{display:'flex',gap:8,marginBottom:12}}>
              {['info','uyari','guncelleme','sistem'].map(t=>(
                <button key={t} onClick={()=>setMT(t)}
                  style={{flex:1,padding:'8px 4px',border:'none',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:11,
                    background:manTip===t?(tipRenk[t]+'33'):'transparent',
                    color:manTip===t?tipRenk[t]:C.muted,
                    border:`1px solid ${manTip===t?tipRenk[t]:C.border}`}}>
                  {tipAdi[t]}
                </button>
              ))}
            </div>
            <input style={{...s.input,marginBottom:10}} placeholder="Duyuru basligi" value={manBaslik} onChange={e=>setMB(e.target.value)}/>
            <textarea style={{...s.input,minHeight:80,resize:'vertical',marginBottom:10}} placeholder="Duyuru icerik" value={manIcerik} onChange={e=>setMI(e.target.value)}/>
            <button onClick={manuelEkle} style={{...s.btn,background:tipRenk[manTip]||C.accent}}>Yayinla</button>
          </Card>
          <Card>
            <H title="Toplu Silme"/>
            <button onClick={async()=>{
              if(!confirm('Tum haberleri sil? (Duyurular kalir)')) return;
              const q2=query(collection(db,'announcements'),orderBy('createdAt','desc'),limit(100));
              const snap=await getDocs(q2);
              let c=0;
              for(const d of snap.docs){
                if(d.data().tip==='haber'){await deleteDoc(doc(db,'announcements',d.id));c++;}
              }
              alert(c+' haber silindi');
            }} style={{...s.btn,background:C.redBg,border:`1px solid ${C.red}`,color:C.red}}>
              Tum Haberleri Sil
            </button>
            <button onClick={async()=>{
              if(!confirm('Tum duyurulari sil?')) return;
              const q2=query(collection(db,'announcements'),orderBy('createdAt','desc'),limit(100));
              const snap=await getDocs(q2);
              let c=0;
              for(const d of snap.docs){
                if(d.data().tip!=='haber'){await deleteDoc(doc(db,'announcements',d.id));c++;}
              }
              alert(c+' duyuru silindi');
            }} style={{...s.btn,background:C.yellowBg,border:`1px solid ${C.yellow}`,color:C.yellow,marginTop:8}}>
              Tum Duyurulari Sil
            </button>
          </Card>
        </div>
      )}

      {/* ISTATISTIK TAB */}
      {tab==='istatistik' && (
        <div style={s.scrollArea}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <Card style={{...s.half,borderColor:C.purple}}>
              <span style={s.label}>KULLANICI</span>
              <div style={{fontSize:32,fontWeight:900,color:C.purple}}>{stats?.userCount||'-'}</div>
            </Card>
            <Card style={{...s.half,borderColor:C.accent}}>
              <span style={s.label}>DUYURU</span>
              <div style={{fontSize:32,fontWeight:900,color:C.accent}}>{duyurular.length}</div>
            </Card>
            <Card style={{...s.half,borderColor:C.blue}}>
              <span style={s.label}>HABER</span>
              <div style={{fontSize:32,fontWeight:900,color:C.blue}}>{haberler.length}</div>
            </Card>
            <Card style={{...s.half,borderColor:C.orange}}>
              <span style={s.label}>TOPLAM</span>
              <div style={{fontSize:32,fontWeight:900,color:C.orange}}>{annList.length}</div>
            </Card>
          </div>
          <Card>
            <H title="Son 5 Haber" sub="Bot tarafindan eklendi"/>
            {haberler.slice(0,5).map(h=>(
              <div key={h.id} style={s.row}>
                <span style={{...s.body,fontSize:12,flex:1,paddingRight:8}}>{h.baslik?.slice(0,50)}...</span>
                <span style={{fontSize:10,color:C.muted}}>{h.kaynak||'Bot'}</span>
              </div>
            ))}
            {haberler.length===0&&<div style={{...s.tiny,textAlign:'center',padding:'12px 0'}}>Haber yok</div>}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── HABER FEED EKRANI ─────────────────────────────────────────────────────
function NewsFeedScreen({ user }) {
  const [allCards, setAllCards] = useState([]);
  const [cards, setCards]       = useState([]);
  const [idx, setIdx]           = useState(0);
  const [loading, setLoading]   = useState(true);
  const [swipeDir, setSwipe]    = useState(null);
  const [showSaved, setShowS]   = useState(false);
  const [saved, setSaved]       = useState([]);
  const [commentNews, setCN]    = useState(null);
  const [likes, setLikes]       = useState({});
  const [catFilter, setCatF]    = useState('all');
  const [article, setArticle]   = useState(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [newsTab, setNewsTab]   = useState('tr'); // 'tr' | 'global' | 'magazin' 
  const startRef                = useRef(null);
  const dragRef                 = useRef({x:0,y:0});

// SADECE haber tipindekiler
  useEffect(()=>{
    const q = query(collection(db,'announcements'), orderBy('createdAt','desc'), limit(300));
    const unsub = onSnapshot(q, snap=>{
      const docs = snap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.tip==='haber');
      setAllCards(docs);
      setCards([...docs].sort(()=>Math.random()-0.5));
      setLoading(false);
    });
    return unsub;
  },[]);

  // ---- DÜZELTİLEN KISIM: activeCards değişkenleri YUKARI taşındı ----
  const GLOBAL_SOURCES = ['Reuters','Bloomberg','BBC','Financial Times','CNBC','WSJ'];
  const globalCards = allCards.filter(c =>
    GLOBAL_SOURCES.some(s => (c.kaynak||'').includes(s)) ||
    /global|dünya|uluslararası|fed|ecb|world bank|imf/i.test(c.baslik+c.icerik)
  );
  const magazinCards = allCards.filter(c =>
    /magazin|ünlü|celebrity|moda|fashion|sosyal medya|instagram|twitter/i.test(c.baslik+c.icerik)
  );
  const activeCards = newsTab === 'global' ? globalCards
    : newsTab === 'magazin' ? magazinCards
    : cards; // 'tr' - mevcut Türkçe haberler

  // Kategori filtresi
  const NEWS_CATS = [
    {id:'all',label:'📰 Tümü', match: () => true},
    {id:'doviz',label:'💵 Döviz', match: c => /dolar|euro|kur|döviz|usd|eur|sterlin/i.test(c.baslik+c.icerik)},
    {id:'borsa',label:'📊 Borsa', match: c => /bist|hisse|borsa|endeks|xu100|piyasa/i.test(c.baslik+c.icerik)},
    {id:'altin',label:'🥇 Altın', match: c => /altın|altin|gumus|gümüş|emtia/i.test(c.baslik+c.icerik)},
    {id:'kripto',label:'₿ Kripto', match: c => /bitcoin|kripto|btc|eth|crypto/i.test(c.baslik+c.icerik)},
    {id:'mb',label:'🏦 MB/Faiz', match: c => /faiz|merkez|tcmb|enflasyon|tüfe/i.test(c.baslik+c.icerik)},
    {id:'sirket',label:'🏢 Şirket', match: c => /şirket|sirket|thyao|garan|kar|zarar|bilanço|halka arz/i.test(c.baslik+c.icerik)},
    {id:'enerji',label:'⚡ Enerji', match: c => /petrol|doğalgaz|enerji|elektrik|opec/i.test(c.baslik+c.icerik)},
    {id:'pozitif',label:'🟢 Pozitif', match: c => (c.etiket||'').includes('Pozitif') || (c.etiket||'').includes('Yukselis')},
    {id:'riskli',label:'🔴 Riskli', match: c => (c.etiket||'').includes('Riskli') || (c.etiket||'').includes('Dusus')},
  ];
  const activeCatObj = NEWS_CATS.find(n => n.id === catFilter) || NEWS_CATS[0];
  const filteredCards = catFilter === 'all' ? activeCards : activeCards.filter(activeCatObj.match);
  const current = filteredCards[idx];
  const progress = filteredCards.length ? (idx/filteredCards.length)*100 : 0;

  const tipCfg = {
    haber:  {color:C.purple, bg:'#0f0a1f', icon:'📰'},
    info:   {color:C.blue,   bg:'#070d1f', icon:'ℹ️'},
    uyari:  {color:C.yellow, bg:'#100e00', icon:'⚠️'},
  };

  // ---- DÜZELTİLEN KISIM: Tanımsız setDrag çağrıları silindi ----
  const goNext=(dir='up')=>{
    if(idx>=filteredCards.length-1) return;
    setSwipe(dir);
    setTimeout(()=>{ setIdx(i=>i+1); setSwipe(null); dragRef.current={x:0,y:0}; },260);
  };
  const goPrev=()=>{
    if(idx===0) return;
    setSwipe('down');
    setTimeout(()=>{ setIdx(i=>i-1); setSwipe(null); dragRef.current={x:0,y:0}; },260);
  };
  const shuffle=()=>{ setCards([...allCards].sort(()=>Math.random()-0.5)); setIdx(0); setCatF('all'); };
  const saveCard=()=>{ if(current&&!saved.find(s=>s.id===current.id)) setSaved(s=>[...s,current]); };

  // Touch navigation - sadece kartın dışındaki alanlarda çalışır
  const onTouchStart=(e)=>{
    // Kart icindeyse scroll et, disindaysa navigation
    const cardEl = e.currentTarget.querySelector('[data-card="true"]');
    if (cardEl && cardEl.contains(e.target)) return; // kart icinde, isleme
    const t=e.touches[0];
    startRef.current={x:t.clientX,y:t.clientY};
    dragRef.current={x:0,y:0};
  };
  const onTouchMove=(e)=>{
    if(!startRef.current) return;
    const t=e.touches[0];
    const dy=t.clientY-startRef.current.y;
    dragRef.current={x:0,y:dy};
  };
  const onTouchEnd=()=>{
    if (!startRef.current) return;
    const {y}=dragRef.current;
    if(y<-60) goNext('up');
    else if(y>60) goPrev();
    startRef.current=null;
    dragRef.current={x:0,y:0};
  };

  useEffect(()=>{
    const h=(e)=>{
      if(e.key==='ArrowUp') goNext('up');
      if(e.key==='ArrowDown') goPrev();
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[idx,cards.length]);

  // Kaydedilenler ekrani
  if(showSaved){
    return (
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:C.card,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <button onClick={()=>setShowS(false)} style={{background:'none',border:'none',color:C.accent,fontSize:22,cursor:'pointer',lineHeight:1}}>←</button>
          <span style={{fontWeight:800,fontSize:14,color:C.text}}>Kaydedilenler ({saved.length})</span>
        </div>
        <div style={s.scrollArea}>
          {saved.length===0
            ? <div style={{textAlign:'center',padding:'40px 16px',color:C.muted}}>Hic kaydettigin haber yok.</div>
            : saved.map((ann,i)=>{
                const cfg=tipCfg[ann.tip]||tipCfg.haber;
                return (
                  <div key={i} style={{background:cfg.bg,border:`1px solid ${cfg.color}40`,borderRadius:14,marginBottom:10,overflow:'hidden'}}>
                    {ann.image&&<img src={ann.image} alt={ann.baslik} style={{width:'100%',height:120,objectFit:'cover'}} onError={e=>{e.target.style.display='none';}}/>}
                    <div style={{padding:14}}>
                    <div style={{display:'flex',gap:8,marginBottom:8}}>
                      <span style={{fontSize:16}}>{cfg.icon}</span>
                      <span style={{fontWeight:800,fontSize:13,color:cfg.color,flex:1,lineHeight:'18px'}}>{ann.baslik}</span>
                    </div>
                    <div style={{fontSize:13,color:C.dim,lineHeight:'19px',marginBottom:6}}>{ann.icerik}</div>
                    {ann.analiz&&<div style={{fontSize:12,color:cfg.color,background:`${cfg.color}15`,borderRadius:8,padding:'8px 10px',marginBottom:8}}>💡 {ann.analiz}</div>}
                    <div style={{display:'flex',gap:8,alignItems:'center',marginTop:4}}>
                      {ann.url&&<a href={ann.url} target="_blank" rel="noreferrer"
                        style={{fontSize:11,color:cfg.color,background:`${cfg.color}20`,borderRadius:20,padding:'4px 12px',textDecoration:'none',fontWeight:700}}>
                        🔗 Kaynaga Git
                      </a>}
                      <button onClick={()=>setSaved(s=>s.filter((_,j)=>j!==i))}
                        style={{fontSize:11,color:C.muted,background:'none',border:`1px solid ${C.border}`,borderRadius:20,padding:'4px 12px',cursor:'pointer'}}>
                        Kaldir
                      </button>
                    </div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>
    );
  }

  if(loading) return (
    <div style={{flex:1,display:'flex',justifyContent:'center',alignItems:'center',flexDirection:'column',gap:12}}>
      <Spinner size={36}/><span style={{color:C.muted,fontSize:13}}>Haberler yukleniyor...</span>
    </div>
  );

  if(cards.length===0) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',padding:32,textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:12}}>📭</div>
      <div style={{color:C.text,fontWeight:700,fontSize:16,marginBottom:8}}>Haber yok</div>
      <div style={{color:C.muted,fontSize:13}}>Bot 10 dakikada bir otomatik haber paylasiyor.</div>
    </div>
  );

  if(idx>=filteredCards.length) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',padding:32,textAlign:'center'}}>
      <div style={{fontSize:52,marginBottom:16}}>🎉</div>
      <div style={{color:C.text,fontWeight:800,fontSize:18,marginBottom:8}}>Hepsini okudun!</div>
      <div style={{color:C.muted,fontSize:13,marginBottom:24}}>{cards.length} haberin tamami.</div>
      <button onClick={shuffle} style={{...s.btn,width:'auto',padding:'14px 36px'}}>🔀 Tekrar Baslat</button>
      {saved.length>0&&(
        <button onClick={()=>setShowS(true)} style={{...s.btnSec,width:'auto',padding:'12px 32px',marginTop:0}}>
          🔖 Kaydedilenleri Gor ({saved.length})
        </button>
      )}
    </div>
  );

  const cfg = tipCfg[current?.tip]||tipCfg.haber;

  // Sadece yukarı/aşağı animasyon
  const cardStyle=(()=>{
    if(swipeDir==='up')   return {transform:'translateY(-110%)',opacity:0,transition:'all 0.26s ease'};
    if(swipeDir==='down') return {transform:'translateY(110%)', opacity:0,transition:'all 0.26s ease'};
    return {transform:'translateY(0)',opacity:1,transition:'all 0.2s ease'};
  })();




  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:cfg.bg,transition:'background 0.5s'}}>
      {/* Üst ana sekme */}
      <div style={{display:'flex',background:'rgba(0,0,0,0.3)',borderBottom:`1px solid rgba(255,255,255,0.1)`,flexShrink:0}}>
        {[
          {id:'tr',    label:'🇹🇷 Türkiye'},
          {id:'global',label:'🌍 Global'},
          {id:'magazin',label:'⭐ Magazin'},
        ].map(t=>(
          <button key={t.id} onClick={()=>{setNewsTab(t.id);setIdx(0);}}
            style={{flex:1,padding:'9px 4px',border:'none',background:'transparent',cursor:'pointer',
              fontWeight:700,fontSize:11,
              color:newsTab===t.id?cfg.color:'rgba(255,255,255,0.5)',
              borderBottom:`2px solid ${newsTab===t.id?cfg.color:'transparent'}`,
              transition:'all 0.2s'}}>
            {t.label}
          </button>
        ))}
      </div>
      {/* Global/Magazin için özel mesaj */}
      {newsTab==='global' && globalCards.length===0 && (
        <div style={{padding:'20px 16px',textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:13,flexShrink:0}}>
          Global haberler için bot'a "BBC Reuters Bloomberg haberlerini çek" komutu ver
        </div>
      )}
      {newsTab==='magazin' && magazinCards.length===0 && (
        <div style={{padding:'20px 16px',textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:13,flexShrink:0}}>
          Magazin haberleri için admin panelinden "magazin haberi ekle" komutunu dene
        </div>
      )}
      {/* Ust bar */}
      <div style={{padding:'8px 16px 6px',flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:14}}>{cfg.icon}</span>
            <span style={{fontSize:11,fontWeight:700,color:cfg.color,letterSpacing:'1px'}}>HABERLER</span>
            {current?.etiket&&<span style={{fontSize:10,background:`${cfg.color}20`,borderRadius:20,padding:'2px 8px',color:cfg.color}}>{current.etiket}</span>}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontSize:11,color:C.muted}}>{idx+1}/{filteredCards.length} <span style={{opacity:0.5}}>({allCards.length} toplam)</span></span>
            {saved.length>0&&(
              <button onClick={()=>setShowS(true)}
                style={{background:C.accentBg,border:`1px solid ${C.accent}40`,borderRadius:20,padding:'4px 10px',color:C.accent,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                🔖 {saved.length}
              </button>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{height:3,background:'#ffffff10',borderRadius:2,overflow:'hidden',marginBottom:8}}>
          <div style={{height:'100%',width:`${progress}%`,background:cfg.color,borderRadius:2,transition:'width 0.3s'}}/>
        </div>
        {/* Kategori filtresi */}
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:2}}>
          {NEWS_CATS.map(cat=>(
            <button key={cat.id} onClick={()=>{setCatF(cat.id);setIdx(0);}}
              style={{padding:'4px 10px',border:'none',borderRadius:20,cursor:'pointer',
                fontWeight:700,fontSize:10,whiteSpace:'nowrap',flexShrink:0,
                background:catFilter===cat.id?cfg.color:C.border,
                color:catFilter===cat.id?'#0A0E1A':C.muted}}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kart alani */}
      <div style={{flex:1,display:'flex',flexDirection:'column',padding:'8px 16px',position:'relative',overflow:'hidden'}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>



        {/* Arka kart */}
        {cards[idx+1]&&(
          <div style={{position:'absolute',inset:'8px 20px',borderRadius:24,
            background:(tipCfg[cards[idx+1]?.tip]||tipCfg.haber).bg,
            border:`1px solid ${(tipCfg[cards[idx+1]?.tip]||tipCfg.haber).color}30`,
            transform:'scale(0.94) translateY(12px)',zIndex:0}}/>
        )}

        {/* Ana kart */}
        <div data-card="true" style={{position:'relative',zIndex:1,background:cfg.bg,flex:1,
          border:`1px solid ${cfg.color}50`,borderRadius:24,marginTop:8,
          boxShadow:`0 20px 60px ${cfg.color}20`,userSelect:'none',overflow:'hidden',
          display:'flex',flexDirection:'column',...cardStyle}}>

          {/* Haber gorseli */}
          {current?.image && (
            <div style={{width:'100%',height:160,overflow:'hidden',position:'relative',borderRadius:'24px 24px 0 0'}}>
              <img src={current.image} alt={current.baslik}
                style={{width:'100%',height:'100%',objectFit:'cover'}}
                onError={e=>{e.target.style.display='none'; e.target.parentElement.style.display='none';}}/>
              <div style={{position:'absolute',inset:0,background:`linear-gradient(to bottom, transparent 40%, ${cfg.bg} 100%)`}}/>
            </div>
          )}

          <div style={{padding:18,overflowY:'auto',flex:1}}>
            {/* Kaynak + saat */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontSize:11,background:`${cfg.color}25`,borderRadius:20,padding:'3px 10px',color:cfg.color,fontWeight:700}}>
                {current?.kaynak||'Haber'}
              </span>
              <span style={{fontSize:11,color:C.muted,display:'flex',alignItems:'center',gap:4}}>
                🕐 {current?.createdAt?.toDate?.()?.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})||''}
                {' '}
                {current?.createdAt?.toDate?.()?.toLocaleDateString('tr-TR',{day:'numeric',month:'short'})||''}
              </span>
            </div>

            {/* Baslik */}
            <div style={{fontSize:18,fontWeight:900,color:C.text,lineHeight:'24px',marginBottom:10}}>
              {current?.baslik}
            </div>

            {/* Icerik */}
            <div style={{fontSize:13,color:C.dim,lineHeight:'20px',marginBottom:12}}>
              {current?.icerik}
            </div>

            {/* AI analizi */}
            {current?.analiz&&(
              <div style={{background:`${cfg.color}12`,border:`1px solid ${cfg.color}30`,borderRadius:12,padding:10,marginBottom:12}}>
                <div style={{fontSize:10,color:cfg.color,fontWeight:700,letterSpacing:'1px',marginBottom:3}}>💡 AI ANALİZİ</div>
                <div style={{fontSize:12,color:cfg.color,lineHeight:'17px'}}>{current.analiz}</div>
              </div>
            )}

            {/* Beğen + Kaynak */}
            <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
              <button onClick={()=>setLikes(l=>({...l,[current?.id]:!l[current?.id]}))}
                style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,
                  background:likes[current?.id]?C.redBg:C.border,
                  border:`1px solid ${likes[current?.id]?C.red:C.border}`,
                  borderRadius:20,padding:'6px 12px',cursor:'pointer',fontWeight:600,
                  color:likes[current?.id]?C.red:C.muted}}>
                {likes[current?.id]?'❤️':'🤍'}
              </button>
           {current?.url&&(
                <button 
                  onClick={async () => {
                    setArticle({ baslik: current.baslik, url: current.url, text: '' });
                    setArticleLoading(true);
                    try {
                      const res = await fetch(`/api/extract?url=${encodeURIComponent(current.url)}`);
                      const data = await res.json();
                      setArticle(prev => ({ ...prev, text: data.text }));
                    } catch (e) {
                      setArticle(prev => ({ ...prev, text: 'Haber metni çekilemedi.' }));
                    }
                    setArticleLoading(false);
                  }}
                  style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,color:cfg.color,
                    background:`${cfg.color}15`,border:'none',borderRadius:20,padding:'6px 12px',cursor:'pointer',fontWeight:700}}>
                  {articleLoading ? <Spinner size={12} color={cfg.color}/> : '📖 Devamını Oku'}
                </button>
              )}
              {current?.url&&(
                <a href={current.url} target="_blank" rel="noreferrer"
                  style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,color:C.muted,
                    background:C.border,borderRadius:20,padding:'6px 12px',textDecoration:'none'}}>
                  🔗
                </a>
              )}
            </div>
            
            {/* Yorumlar - İÇERİYE GÖMÜLDÜ ÇÖKME ENGELLENDİ */}
            {current?.id && (
              <div onClick={()=>setCN({id:current.id,baslik:current.baslik})}
                   style={{padding:'10px', background:'rgba(255,255,255,0.05)', borderRadius:'12px', marginTop:'10px', textAlign:'center', cursor:'pointer'}}>
                <span style={{fontSize:12, color:C.muted, fontWeight:700}}>💬 Yorumları Gör...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Makale okuma modali */}
      {article && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',
            background:C.card,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:13,color:C.text,overflow:'hidden',
                textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{article.baslik}</div>
            </div>
            <div style={{display:'flex',gap:8,marginLeft:8}}>
              <a href={article.url} target="_blank" rel="noreferrer"
                style={{background:C.accentBg,border:`1px solid ${C.accent}40`,borderRadius:20,
                  padding:'6px 12px',color:C.accent,fontSize:11,fontWeight:700,textDecoration:'none'}}>
                Tarayıcıda Aç
              </a>
              <button onClick={()=>setArticle(null)}
                style={{background:C.border,border:'none',borderRadius:20,width:32,height:32,
                  cursor:'pointer',color:C.text,fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>
                ×
              </button>
            </div>
          </div>
          <iframe src={article.url} style={{flex:1,border:'none',background:'#fff'}} title={article.baslik} sandbox="allow-scripts allow-same-origin allow-popups" />
        </div>
      )}
      
      {/* Yorum modali - İÇERİYE GÖMÜLDÜ ÇÖKME ENGELLENDİ */}
      {commentNews && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:999, display:'flex', justifyContent:'center', alignItems:'center', padding:20}}>
          <div style={{background:C.card, border:`1px solid ${C.border}`, padding:24, borderRadius:20, width:'100%', maxWidth:400}}>
            <h3 style={{color:C.text, marginTop:0, fontSize:16}}>{commentNews.baslik}</h3>
            <p style={{color:C.muted, fontSize:13, marginBottom:20}}>Yorum sistemi yakında eklenecek...</p>
            <button onClick={()=>setCN(null)} style={{...s.btn, background:C.accent, width:'100%'}}>Kapat</button>
          </div>
        </div>
      )}

      {/* Navigasyon butonlari */}
      <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:24,padding:'12px 16px 20px',flexShrink:0}}>
        <button onClick={goPrev} disabled={idx===0}
          style={{width:52,height:52,borderRadius:26,background:idx===0?'#111':C.yellowBg,
            border:`2px solid ${idx===0?C.border:C.yellow}`,display:'flex',alignItems:'center',
            justifyContent:'center',cursor:idx===0?'default':'pointer',fontSize:22,opacity:idx===0?0.3:1}}>↑</button>
        <button onClick={saveCard}
          style={{width:52,height:52,borderRadius:26,
            background:saved.find(s=>s.id===current?.id)?C.accentBg:'#1a1a2e',
            border:`2px solid ${saved.find(s=>s.id===current?.id)?C.accent:C.border}`,
            display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:20}}>🔖</button>
        <button onClick={()=>goNext('up')} disabled={idx>=cards.length-1}
          style={{width:52,height:52,borderRadius:26,background:idx>=cards.length-1?'#111':C.blueBg,
            border:`2px solid ${idx>=cards.length-1?C.border:C.blue}`,display:'flex',alignItems:'center',
            justifyContent:'center',cursor:idx>=cards.length-1?'default':'pointer',fontSize:22,opacity:idx>=cards.length-1?0.3:1}}>↓</button>
      </div>
    </div>
  );
}



// ─── BIST HİSSE EKRANI ─────────────────────────────────────────────────────
// Tüm BIST hisseleri
const BIST_STOCKS = [
  // BIST 30
  {code:'THYAO',name:'Turk Hava Yollari',sektor:'Ulasim'},
  {code:'GARAN',name:'Garanti BBVA',sektor:'Banka'},
  {code:'ASELS',name:'Aselsan',sektor:'Savunma'},
  {code:'EREGL',name:'Eregli Demir Celik',sektor:'Metal'},
  {code:'BIMAS',name:'BIM Birlesik Magazalar',sektor:'Perakende'},
  {code:'AKBNK',name:'Akbank',sektor:'Banka'},
  {code:'YKBNK',name:'Yapi ve Kredi Bankasi',sektor:'Banka'},
  {code:'SAHOL',name:'Sabanci Holding',sektor:'Holding'},
  {code:'KCHOL',name:'Koc Holding',sektor:'Holding'},
  {code:'SISE',name:'Sise ve Cam',sektor:'Cam'},
  {code:'TUPRS',name:'Tupras',sektor:'Petrol'},
  {code:'ARCLK',name:'Arcelik',sektor:'Beyaz Esya'},
  {code:'TCELL',name:'Turkcell',sektor:'Telekom'},
  {code:'FROTO',name:'Ford Otosan',sektor:'Otomotiv'},
  {code:'TOASO',name:'Tofas',sektor:'Otomotiv'},
  {code:'EKGYO',name:'Emlak Konut GYO',sektor:'GYO'},
  {code:'ISCTR',name:'Is Bankasi C',sektor:'Banka'},
  {code:'HALKB',name:'Halkbank',sektor:'Banka'},
  {code:'VAKBN',name:'Vakifbank',sektor:'Banka'},
  {code:'PGSUS',name:'Pegasus',sektor:'Ulasim'},
  {code:'KOZAL',name:'Koza Altin',sektor:'Maden'},
  {code:'PETKM',name:'Petkim',sektor:'Petrokimya'},
  {code:'TAVHL',name:'TAV Havalimanlari',sektor:'Ulasim'},
  {code:'TKFEN',name:'Tekfen Holding',sektor:'Holding'},
  {code:'DOHOL',name:'Dogan Holding',sektor:'Holding'},
  {code:'MGROS',name:'Migros',sektor:'Perakende'},
  {code:'ULKER',name:'Ulker Biskuvi',sektor:'Gida'},
  {code:'ENKAI',name:'Enka Insaat',sektor:'Insaat'},
  {code:'OTKAR',name:'Otokar',sektor:'Savunma'},
  {code:'LOGO',name:'Logo Yazilim',sektor:'Teknoloji'},
  // Diger BIST hisseleri
  {code:'AEFES',name:'Anadolu Efes',sektor:'Icecek'},
  {code:'AGHOL',name:'AG Anadolu Grubu',sektor:'Holding'},
  {code:'AKGRT',name:'Aksigorta',sektor:'Sigorta'},
  {code:'ALGYO',name:'Alarko GYO',sektor:'GYO'},
  {code:'ALKIM',name:'Alkim Kimya',sektor:'Kimya'},
  {code:'ALYAG',name:'Altin Yunus Cesme',sektor:'Turizm'},
  {code:'ANELE',name:'Anel Elektrik',sektor:'Enerji'},
  {code:'ARASE',name:'Aras Kargo',sektor:'Lojistik'},
  {code:'ARDYZ',name:'ARD Bilisim',sektor:'Teknoloji'},
  {code:'ARSAN',name:'Arsan Tekstil',sektor:'Tekstil'},
  {code:'AYCES',name:'Altinyunus',sektor:'Turizm'},
  {code:'AYGAZ',name:'Aygaz',sektor:'Enerji'},
  {code:'BAGFS',name:'Bagfas Gubre',sektor:'Kimya'},
  {code:'BASGZ',name:'Baskent Dogalgaz',sektor:'Enerji'},
  {code:'BFREN',name:'Bosch Fren',sektor:'Otomotiv'},
  {code:'BIENY',name:'Bien Yapi',sektor:'Insaat'},
  {code:'BIGCH',name:'Bigchef',sektor:'Restoran'},
  {code:'BIZIM',name:'Bizim Toptan',sektor:'Perakende'},
  {code:'BOBET',name:'Bogazici Beton',sektor:'Insaat'},
  {code:'BOSSA',name:'Bossa Ticaret',sektor:'Tekstil'},
  {code:'BRISA',name:'Brisa Bridgestone',sektor:'Otomotiv'},
  {code:'BRKSN',name:'Berkosan Yalitim',sektor:'Insaat'},
  {code:'BRYAT',name:'Boy Yatirim',sektor:'Holding'},
  {code:'BSOKE',name:'Batisoke Cimento',sektor:'Cimento'},
  {code:'BTCIM',name:'Bati Cimento',sektor:'Cimento'},
  {code:'BUCIM',name:'Bursa Cimento',sektor:'Cimento'},
  {code:'BURCE',name:'Burcelik',sektor:'Metal'},
  {code:'BURVA',name:'Bursa Yatirim',sektor:'Holding'},
  {code:'CCOLA',name:'Coca-Cola Icecek',sektor:'Icecek'},
  {code:'CEMAS',name:'Cemas Dokum',sektor:'Metal'},
  {code:'CEMTS',name:'Cementro',sektor:'Cimento'},
  {code:'CIMSA',name:'Cimsa Cimento',sektor:'Cimento'},
  {code:'CLEBI',name:'Celebi Hava Servisi',sektor:'Ulasim'},
  {code:'CMBTN',name:'Combinator',sektor:'Teknoloji'},
  {code:'CRFSA',name:'CarrefourSA',sektor:'Perakende'},
  {code:'CWENE',name:'Cleanworld Enerji',sektor:'Enerji'},
  {code:'DAPGM',name:'Dap Yatirim',sektor:'GYO'},
  {code:'DCILC',name:'Dogan Sirketler Grubu',sektor:'Holding'},
  {code:'DENGE',name:'Denge Yatirim',sektor:'Holding'},
  {code:'DENTA',name:'Denta Klinik',sektor:'Saglik'},
  {code:'DERIM',name:'Derim Deri',sektor:'Tekstil'},
  {code:'DESA',name:'Desa Deri',sektor:'Tekstil'},
  {code:'DESPC',name:'Despas Insaat',sektor:'Insaat'},
  {code:'DEVA',name:'Deva Holding',sektor:'Ilac'},
  {code:'DGATE',name:'Datagate Bilgisayar',sektor:'Teknoloji'},
  {code:'DGINV',name:'Dogan Gazetecilik',sektor:'Medya'},
  {code:'DITAS',name:'Ditas Dorse',sektor:'Otomotiv'},
  {code:'DOGUB',name:'Dogusan Boru',sektor:'Metal'},
  {code:'DURDO',name:'Duran Dogan Basim',sektor:'Matbaa'},
  {code:'DYOBY',name:'DYO Boya',sektor:'Kimya'},
  {code:'DZGYO',name:'Deniz GYO',sektor:'GYO'},
  {code:'ECILC',name:'Eczacibasi Ilac',sektor:'Ilac'},
  {code:'ECZYT',name:'Eczacibasi Yatirim',sektor:'Holding'},
  {code:'EDIP',name:'Edip Gayrimenkul',sektor:'GYO'},
  {code:'EGEEN',name:'Ege Endustri',sektor:'Metal'},
  {code:'EGGUB',name:'Ege Gubre',sektor:'Kimya'},
  {code:'EGPRO',name:'Ege Profil',sektor:'Plastik'},
  {code:'EGSER',name:'Ege Seramik',sektor:'Seramik'},
  {code:'EMKEL',name:'Emkel Elektrik',sektor:'Enerji'},
  {code:'ENJSA',name:'Enerjisa Enerji',sektor:'Enerji'},
  {code:'EPLAS',name:'Emek Plastik',sektor:'Plastik'},
  {code:'ERBOS',name:'Erbosan',sektor:'Metal'},
  {code:'ESCOM',name:'Esas Holding',sektor:'Holding'},
  {code:'ETILR',name:'Etiler Gida',sektor:'Gida'},
  {code:'EUHOL',name:'Euro Holding',sektor:'Holding'},
  {code:'EUPWR',name:'Euro Power',sektor:'Enerji'},
  {code:'EUREN',name:'Euro Enerji',sektor:'Enerji'},
  {code:'FENER',name:'Fenerbahce SK',sektor:'Spor'},
  {code:'FLAP',name:'Flap Kongre',sektor:'Turizm'},
  {code:'FMIZP',name:'Fazil Mert',sektor:'Metal'},
  {code:'FONET',name:'Fonet Bilgi',sektor:'Teknoloji'},
  {code:'FORMT',name:'Formnet',sektor:'Teknoloji'},
  {code:'FORTE',name:'Forte Yatırım',sektor:'Holding'},
  {code:'GENTS',name:'Gentaş Genel Metal',sektor:'Metal'},
  {code:'GEREL',name:'Gersan Elektrik',sektor:'Enerji'},
  {code:'GLBMD',name:'Global Menkul',sektor:'Finans'},
  {code:'GLCVY',name:'Golcuk Yatirim',sektor:'Holding'},
  {code:'GLYHO',name:'Global Yatirim Holding',sektor:'Holding'},
  {code:'GOKNR',name:'Goknar Yatirim',sektor:'Holding'},
  {code:'GOLTS',name:'Goltas Cimento',sektor:'Cimento'},
  {code:'GOZDE',name:'Gozde Girisim',sektor:'Holding'},
  {code:'GRNYO',name:'Garanti BBVA GYO',sektor:'GYO'},
  {code:'GRSEL',name:'Gursel Turizm',sektor:'Turizm'},
  {code:'GSDHO',name:'GSD Holding',sektor:'Holding'},
  {code:'GSRAY',name:'Galatasaray SK',sektor:'Spor'},
  {code:'GUBRF',name:'Gubre Fabrikalari',sektor:'Kimya'},
  {code:'HEKTS',name:'Hektas',sektor:'Kimya'},
  {code:'HLGYO',name:'Halk GYO',sektor:'GYO'},
  {code:'HTTBT',name:'Hattat Petrol',sektor:'Petrol'},
  {code:'HUNER',name:'Huner Enerji',sektor:'Enerji'},
  {code:'HURGZ',name:'Hurriyet Gazetecilik',sektor:'Medya'},
  {code:'IEYHO',name:'IE Yatirim',sektor:'Holding'},
  {code:'IHEVA',name:'Ihlas Ev Aletleri',sektor:'Beyaz Esya'},
  {code:'IHGZT',name:'Ihlas Gazetecilik',sektor:'Medya'},
  {code:'IHLAS',name:'Ihlas Holding',sektor:'Holding'},
  {code:'IHLGM',name:'Ihlas Gayrimenkul',sektor:'GYO'},
  {code:'IMASM',name:'Ima Metal',sektor:'Metal'},
  {code:'INDES',name:'Index Grup',sektor:'Teknoloji'},
  {code:'INFO',name:'Info Yatirim',sektor:'Finans'},
  {code:'INTEM',name:'Intem Bilgisayar',sektor:'Teknoloji'},
  {code:'IPEKE',name:'Ipek Enerji',sektor:'Enerji'},
  {code:'ISATR',name:'Is Bankasi A',sektor:'Banka'},
  {code:'ISBIR',name:'Is Birlesik Magazalar',sektor:'Perakende'},
  {code:'ISCTR',name:'Is Bankasi C',sektor:'Banka'},
  {code:'ISFIN',name:'Is Finansal Kiralama',sektor:'Finans'},
  {code:'ISGSY',name:'Is GYO',sektor:'GYO'},
  {code:'ISGYO',name:'Is Gayrimenkul Yatirim',sektor:'GYO'},
  {code:'ISKPL',name:'Is Kuleleri',sektor:'GYO'},
  {code:'ISMEN',name:'Is Menkul',sektor:'Finans'},
  {code:'ISYAT',name:'Is Yatirim',sektor:'Finans'},
  {code:'ITTFH',name:'ITT Fayda',sektor:'Teknoloji'},
  {code:'IZINV',name:'Izmir Inversiones',sektor:'Holding'},
  {code:'JANTS',name:'Jantsa',sektor:'Otomotiv'},
  {code:'KAREL',name:'Karel Elektronik',sektor:'Teknoloji'},
  {code:'KARTN',name:'Kartonsan',sektor:'Kagit'},
  {code:'KATMR',name:'Katmer Araclar',sektor:'Otomotiv'},
  {code:'KAYSE',name:'Kayseri Seker',sektor:'Gida'},
  {code:'KCAER',name:'Koc ve Enerji',sektor:'Enerji'},
  {code:'KENT',name:'Kent Gida',sektor:'Gida'},
  {code:'KERVN',name:'Kervan Gida',sektor:'Gida'},
  {code:'KERVT',name:'Kervan Tekstil',sektor:'Tekstil'},
  {code:'KLRHO',name:'Kilronan Holding',sektor:'Holding'},
  {code:'KNFRT',name:'Konfrut Gida',sektor:'Gida'},
  {code:'KONTR',name:'Kontrolmatik',sektor:'Teknoloji'},
  {code:'KONYA',name:'Konya Cimento',sektor:'Cimento'},
  {code:'KOPOL',name:'Koc Polisaj',sektor:'Kimya'},
  {code:'KORDS',name:'Kordsa',sektor:'Tekstil'},
  {code:'KOZAA',name:'Koza Anadolu Metal',sektor:'Maden'},
  {code:'KRDMD',name:'Kardemir D',sektor:'Metal'},
  {code:'KRSTL',name:'Kristal Kola',sektor:'Icecek'},
  {code:'KRTEK',name:'Karsu Tekstil',sektor:'Tekstil'},
  {code:'KRVGD',name:'Karavan Gida',sektor:'Gida'},
  {code:'KUTPO',name:'Kutahya Porselen',sektor:'Seramik'},
  {code:'LKMNH',name:'Lokman Hekim',sektor:'Saglik'},
  {code:'LRSHO',name:'Loryma Resort',sektor:'Turizm'},
  {code:'LUKSK',name:'Luks Kadife',sektor:'Tekstil'},
  {code:'MAALT',name:'Marmaris Altinyunus',sektor:'Turizm'},
  {code:'MACKO',name:'Mackolik',sektor:'Teknoloji'},
  {code:'MARTI',name:'Marti Otel',sektor:'Turizm'},
  {code:'MAVI',name:'Mavi Giyim',sektor:'Tekstil'},
  {code:'MEDTR',name:'Meditera Tibbi',sektor:'Saglik'},
  {code:'MEGAP',name:'Mega Polietilen',sektor:'Plastik'},
  {code:'MEPET',name:'Mepet Petrol',sektor:'Petrol'},
  {code:'MERCN',name:'Mercan Kimya',sektor:'Kimya'},
  {code:'MERIT',name:'Merit Turizm',sektor:'Turizm'},
  {code:'MERKO',name:'Merko Gida',sektor:'Gida'},
  {code:'METRO',name:'Metro Holding',sektor:'Holding'},
  {code:'MIPAZ',name:'Milpa Ticari',sektor:'Perakende'},
  {code:'MNDRS',name:'Menderes Tekstil',sektor:'Tekstil'},
  {code:'MPARK',name:'MLP Saglik',sektor:'Saglik'},
  {code:'MRGYO',name:'Margun GYO',sektor:'GYO'},
  {code:'MTRKS',name:'Metriks',sektor:'Teknoloji'},
  {code:'NATEN',name:'Naturel Enerji',sektor:'Enerji'},
  {code:'NETAS',name:'Netas Telekomunikasyon',sektor:'Telekom'},
  {code:'NTHOL',name:'Net Holding',sektor:'Holding'},
  {code:'NUGYO',name:'Nurol GYO',sektor:'GYO'},
  {code:'NUHCM',name:'Nuh Cimento',sektor:'Cimento'},
  {code:'OBASE',name:'Obase Bilgisayar',sektor:'Teknoloji'},
  {code:'ODAS',name:'Odas Elektrik',sektor:'Enerji'},
  {code:'ONCSM',name:'Oncu Yatirim',sektor:'Holding'},
  {code:'ORCAY',name:'Orcay Ortaklik',sektor:'Holding'},
  {code:'ORGE',name:'Orge Enerji',sektor:'Enerji'},
  {code:'ORMA',name:'Orma Orman',sektor:'Agac'},
  {code:'OSMEN',name:'Osmanli Menkul',sektor:'Finans'},
  {code:'OYAYO',name:'Oyak Yatirim',sektor:'Finans'},
  {code:'OYLUM',name:'Oylum Sinai',sektor:'Gida'},
  {code:'OZGYO',name:'Ozak GYO',sektor:'GYO'},
  {code:'OZKGY',name:'Ozak Gayrimenkul',sektor:'GYO'},
  {code:'PAGYO',name:'Pera GYO',sektor:'GYO'},
  {code:'PAMEL',name:'Pan Elektronik',sektor:'Elektronik'},
  {code:'PAPIL',name:'Paperwork',sektor:'Kagit'},
  {code:'PCILT',name:'PC Istanbul',sektor:'Teknoloji'},
  {code:'PEHOL',name:'Peker Holding',sektor:'Holding'},
  {code:'PETUN',name:'Pinar Et ve Un',sektor:'Gida'},
  {code:'PFKPR',name:'Profilo Holding',sektor:'Holding'},
  {code:'PNSUT',name:'Pinar Sut',sektor:'Gida'},
  {code:'POLHO',name:'Polisan Holding',sektor:'Kimya'},
  {code:'POLTK',name:'Politika Yatirim',sektor:'Holding'},
  {code:'PRZMA',name:'Prizma Press',sektor:'Matbaa'},
  {code:'QNBFL',name:'QNB Finansleasing',sektor:'Finans'},
  {code:'QUAGR',name:'QUA Granite',sektor:'Seramik'},
  {code:'RAYSG',name:'Ray Sigorta',sektor:'Sigorta'},
  {code:'RGYAS',name:'Reysas GYO',sektor:'GYO'},
  {code:'RODRG',name:'Rodriguez Garments',sektor:'Tekstil'},
  {code:'ROYAL',name:'Royal Hali',sektor:'Tekstil'},
  {code:'RTALB',name:'RTA Laboratuvarlari',sektor:'Saglik'},
  {code:'RUBNS',name:'Rubenis Tekstil',sektor:'Tekstil'},
  {code:'RYGYO',name:'Reysas Lojistik GYO',sektor:'GYO'},
  {code:'RYSAS',name:'Reysas Lojistik',sektor:'Lojistik'},
  {code:'SARKY',name:'Sarkuysan',sektor:'Metal'},
  {code:'SAYAS',name:'Say Reklamcilik',sektor:'Medya'},
  {code:'SDTTR',name:'SDT Uzay',sektor:'Savunma'},
  {code:'SELEC',name:'Selcuk Ecza',sektor:'Ilac'},
  {code:'SELGD',name:'Selva Gida',sektor:'Gida'},
  {code:'SEMAS',name:'Sema Pnomatik',sektor:'Makine'},
  {code:'SEYKM',name:'Seydisehir Aluminyum',sektor:'Metal'},
  {code:'SILVR',name:'Silver Yatirim',sektor:'Maden'},
  {code:'SKBNK',name:'Sekerbank',sektor:'Banka'},
  {code:'SKYMD',name:'Sky Medya',sektor:'Medya'},
  {code:'SMART',name:'Smart Gunes',sektor:'Enerji'},
  {code:'SNGYO',name:'Sinpas GYO',sektor:'GYO'},
  {code:'SNICA',name:'Sanica Boru',sektor:'Metal'},
  {code:'SNKRN',name:'Sankrono Moda',sektor:'Tekstil'},
  {code:'SODSN',name:'Soda Sanayii',sektor:'Kimya'},
  {code:'SONME',name:'Sonmez Pamuklu',sektor:'Tekstil'},
  {code:'SRVGY',name:'Servet GYO',sektor:'GYO'},
  {code:'SUWEN',name:'Suwen Ic Giyim',sektor:'Tekstil'},
  {code:'TABGD',name:'TAB Gida',sektor:'Restoran'},
  {code:'TATGD',name:'Tat Gida',sektor:'Gida'},
  {code:'TBORG',name:'Turk Tuborg',sektor:'Icecek'},
  {code:'TGSAS',name:'TGS Dis Ticaret',sektor:'Holding'},
  {code:'TKURU',name:'Turk Kurulus',sektor:'Tekstil'},
  {code:'TLMAN',name:'Trabzonspor',sektor:'Spor'},
  {code:'TMPOL',name:'TMO Polipropilen',sektor:'Plastik'},
  {code:'TMSN',name:'Tumosan Motor',sektor:'Makine'},
  {code:'TNZTP',name:'Tanzi Tekstil Pruva',sektor:'Tekstil'},
  {code:'TOASO',name:'Tofas',sektor:'Otomotiv'},
  {code:'TRCAS',name:'Turcas Petrol',sektor:'Petrol'},
  {code:'TRGYO',name:'Torunlar GYO',sektor:'GYO'},
  {code:'TRILC',name:'Trilyum Girisim',sektor:'Teknoloji'},
  {code:'TSGYO',name:'TSG GYO',sektor:'GYO'},
  {code:'TSKB',name:'TSKB',sektor:'Banka'},
  {code:'TSPOR',name:'Trabzonspor Sportif',sektor:'Spor'},
  {code:'TTKOM',name:'Turk Telekomunikasyon',sektor:'Telekom'},
  {code:'TTRAK',name:'Turk Traktor',sektor:'Makine'},
  {code:'TUCLK',name:'Tugra Celik',sektor:'Metal'},
  {code:'TUKAS',name:'Tukas',sektor:'Gida'},
  {code:'TUREX',name:'Tureks Turizm',sektor:'Turizm'},
  {code:'TURGG',name:'Turk Sigorta',sektor:'Sigorta'},
  {code:'TZNTR',name:'Tezsan Elektrik',sektor:'Elektronik'},
  {code:'ULUUN',name:'Ulupinar Un',sektor:'Gida'},
  {code:'ULUSE',name:'Ulusoy Elektrik',sektor:'Enerji'},
  {code:'ULUSY',name:'Ulusoy Sanayi',sektor:'Holding'},
  {code:'UMPAS',name:'Umpas Holding',sektor:'Holding'},
  {code:'UNLU',name:'Unlu Tekstil',sektor:'Tekstil'},
  {code:'USDTR',name:'USD Tekstil',sektor:'Tekstil'},
  {code:'VAKFN',name:'Vakif Finansal',sektor:'Finans'},
  {code:'VAKKO',name:'Vakko Tekstil',sektor:'Tekstil'},
  {code:'VANGD',name:'Van Gol Gida',sektor:'Gida'},
  {code:'VBTYZ',name:'VBT Yazilim',sektor:'Teknoloji'},
  {code:'VERTU',name:'Vertu Yatirim',sektor:'Holding'},
  {code:'VESBE',name:'Vestel Beyaz Esya',sektor:'Beyaz Esya'},
  {code:'VESTL',name:'Vestel',sektor:'Elektronik'},
  {code:'VKFYO',name:'Vakif GYO',sektor:'GYO'},
  {code:'VKGYO',name:'Vakif Gayrimenkul',sektor:'GYO'},
  {code:'VRGYO',name:'Varlik GYO',sektor:'GYO'},
  {code:'YAPRK',name:'Yaprak Sut',sektor:'Gida'},
  {code:'YATAS',name:'Yatas',sektor:'Mobilya'},
  {code:'YAYLA',name:'Yayla Agro Gida',sektor:'Gida'},
  {code:'YBTKS',name:'Yibiteks Tekstil',sektor:'Tekstil'},
  {code:'YGYO',name:'Yeni Gimat GYO',sektor:'GYO'},
  {code:'YKGYO',name:'Yapi Kredi GYO',sektor:'GYO'},
  {code:'YKSLN',name:'Yukselis Holding',sektor:'Holding'},
  {code:'YUNSA',name:'Yunsa',sektor:'Tekstil'},
  {code:'ZOREN',name:'Zorlu Enerji',sektor:'Enerji'},
  {code:'ZRGYO',name:'Ziraat GYO',sektor:'GYO'},
];

// Toplu fiyat cekme - /api/prices endpoint
async function fetchBulkPrices(codes) {
  const tickers = codes.map(c => c.includes('.') ? c : `${c}.IS`).join(',');
  const res = await fetch('/api/prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers }),
  });
  const data = await res.json();
  const result = {};
  for (const [sym, info] of Object.entries(data.prices || {})) {
    const code = sym.replace('.IS','');
    result[code] = info;
  }
  return result;
}

function StocksScreen({ data, setData }) {
  const [prices, setPrices]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [loadingAll, setLA]     = useState(false);
  const [search, setSearch]     = useState('');
  const [tab, setTab]           = useState('tumuSorted');
  const [lastUpdate, setLU]     = useState(null);
  const [selectedStock, setSS]  = useState(null);
  const favs = data.settings?.favStocks || [];

  const toggleFav = (code) => {
    const newFavs = favs.includes(code) ? favs.filter(c => c !== code) : [...favs, code];
    setData(d => ({...d, settings: {...d.settings, favStocks: newFavs}}));
  };

  // Fiyatları yukle - toplu olarak, BIST 30 once
  const loadPrices = async (priority = false) => {
    if (loading || loadingAll) return;
    setLoading(true);

    // Bist30 + favoriler once
    const bist30 = BIST_STOCKS.slice(0,30).map(s=>s.code);
    const firstBatch = [...new Set([...favs, ...bist30])].slice(0, 50);
    try {
      const p1 = await fetchBulkPrices(firstBatch);
      setPrices(prev => ({...prev, ...p1}));
    } catch(e) { console.error(e); }
    setLoading(false);
    setLU(new Date());

    if (!priority) {
      // Kalanları arka planda yükle - 50'lik gruplar halinde
      setLA(true);
      const remaining = BIST_STOCKS.slice(30).map(s=>s.code).filter(c => !firstBatch.includes(c));
      for (let i = 0; i < remaining.length; i += 50) {
        const batch = remaining.slice(i, i+50);
        try {
          const p = await fetchBulkPrices(batch);
          setPrices(prev => ({...prev, ...p}));
        } catch {}
        await new Promise(r => setTimeout(r, 500));
      }
      setLA(false);
      setLU(new Date());
    }
  };

  // Ekrana girilince otomatik yukle
  useEffect(() => { loadPrices(); }, []);

  // Filtrelenmiş liste
  const filtered = BIST_STOCKS.filter(s =>
    !search ||
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.sektor.toLowerCase().includes(search.toLowerCase())
  );

  // Sekmeye gore sirala
  const displayed = (() => {
    let list = tab === 'favoriler' ? filtered.filter(s => favs.includes(s.code)) : filtered;
    if (tab === 'yukselenler') list = list.filter(s => (prices[s.code]?.change||0) > 0).sort((a,b) => (prices[b.code]?.change||0) - (prices[a.code]?.change||0));
    if (tab === 'dusenler')    list = list.filter(s => (prices[s.code]?.change||0) < 0).sort((a,b) => (prices[a.code]?.change||0) - (prices[b.code]?.change||0));
    return list;
  })();

  const loadedCount = Object.keys(prices).length;

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'10px 16px 8px',background:C.card,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div>
            <span style={{fontWeight:800,fontSize:14,color:C.text}}>BIST Hisseleri</span>
            <span style={{fontSize:10,color:C.muted,marginLeft:8}}>
              {loadedCount}/{BIST_STOCKS.length} fiyat
              {loadingAll && <span style={{color:C.accent}}> (yukleniyor...)</span>}
            </span>
          </div>
          <button onClick={()=>loadPrices(true)} disabled={loading||loadingAll}
            style={{background:loading||loadingAll?C.border:C.accentBg,border:`1px solid ${loading||loadingAll?C.border:C.accent}40`,
              borderRadius:20,padding:'5px 12px',color:loading||loadingAll?C.muted:C.accent,
              fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
            {loading?<Spinner size={12} color={C.accent}/>:'↺'} Guncelle
          </button>
        </div>
        {lastUpdate && (
          <div style={{fontSize:10,color:C.muted,marginBottom:6}}>
            Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}
          </div>
        )}
        {/* Arama */}
        <input style={{...s.input,marginBottom:8,padding:'9px 12px'}}
          placeholder="Hisse, şirket veya sektör ara..."
          value={search} onChange={e=>setSearch(e.target.value)}/>
        {/* Sekmeler */}
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:2}}>
          {[
            {id:'tumuSorted',l:`Tümü (${BIST_STOCKS.length})`},
            {id:'favoriler', l:`⭐ (${favs.length})`},
            {id:'yukselenler',l:'📈 Yükselenler'},
            {id:'dusenler',  l:'📉 Düşenler'},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:'6px 12px',border:'none',borderRadius:20,cursor:'pointer',fontWeight:700,
                fontSize:11,whiteSpace:'nowrap',flexShrink:0,
                background:tab===t.id?C.accent:C.border,
                color:tab===t.id?'#0A0E1A':C.muted}}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div style={{flex:1,overflowY:'auto',padding:'0 16px'}}>
        {tab==='favoriler' && favs.length===0 && (
          <div style={{textAlign:'center',padding:'40px 0',color:C.muted}}>
            <div style={{fontSize:36,marginBottom:8}}>⭐</div>
            <div style={{fontWeight:700,color:C.text,marginBottom:4}}>Favori hisse yok</div>
            <div style={{fontSize:12}}>Hissenin yanındaki ⭐ ye tıkla</div>
          </div>
        )}
        {(tab==='yukselenler'||tab==='dusenler') && displayed.length===0 && (
          <div style={{textAlign:'center',padding:'32px 0',color:C.muted}}>
            <div style={{fontSize:13}}>Fiyat verisi yükleniyor...</div>
          </div>
        )}
        {displayed.map(stock => {
          const info   = prices[stock.code];
          const price  = info?.price;
          const chg    = info?.change;
          const isFav  = favs.includes(stock.code);
          const isUp   = chg > 0;
          const isDown = chg < 0;
          return (
            <div key={stock.code}
              onClick={()=>setSS(stock)}
              style={{display:'flex',alignItems:'center',padding:'10px 0',
                borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}>
              {/* Sol: kod + isim + sektör */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontWeight:800,fontSize:14,color:C.text}}>{stock.code}</span>
                  {isFav && <span style={{fontSize:9,color:C.yellow}}>⭐</span>}
                  <span style={{fontSize:9,color:C.muted,background:C.border,borderRadius:20,
                    padding:'1px 6px'}}>{stock.sektor}</span>
                </div>
                <div style={{fontSize:11,color:C.muted,marginTop:1,overflow:'hidden',
                  textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{stock.name}</div>
              </div>
              {/* Sag: fiyat + degisim */}
              <div style={{textAlign:'right',marginRight:10,minWidth:80}}>
                {price != null ? (
                  <>
                    <div style={{fontWeight:800,fontSize:15,color:C.text}}>{fmtD(price)} ₺</div>
                    {chg != null && (
                      <div style={{fontSize:11,fontWeight:700,
                        color:isUp?C.accent:isDown?C.red:C.muted}}>
                        {isUp?'▲':'▼'} %{Math.abs(chg).toFixed(2)}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    {loading ? <Spinner size={14}/> : <span style={{color:C.border,fontSize:14}}>—</span>}
                  </div>
                )}
              </div>
              {/* Favori butonu */}
              <button onClick={()=>toggleFav(stock.code)}
                style={{background:'none',border:`1px solid ${isFav?C.yellow:C.border}`,
                  borderRadius:20,padding:'5px 8px',cursor:'pointer',
                  fontSize:13,color:isFav?C.yellow:C.muted,flexShrink:0}}>
                {isFav?'⭐':'☆'}
              </button>
            </div>
          );
        })}
        {displayed.length > 0 && (
          <div style={{textAlign:'center',padding:'16px 0',color:C.muted,fontSize:11}}>
            {displayed.length} hisse gösteriliyor
          </div>
        )}
      </div>
      {/* Hisse detay modal - İÇERİYE GÖMÜLDÜ ÇÖKME ENGELLENDİ */}
      {selectedStock && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:999, display:'flex', justifyContent:'center', alignItems:'center', padding:20}}>
          <div style={{background:C.card, border:`1px solid ${C.border}`, padding:24, borderRadius:20, width:'100%', maxWidth:400}}>
            <h3 style={{color:C.text, marginTop:0, fontSize:18}}>{selectedStock.name} ({selectedStock.code})</h3>
            <p style={{color:C.muted, fontSize:13, marginBottom:20}}>Detaylı grafik sayfası yapım aşamasında...</p>
            <button onClick={()=>setSS(null)} style={{...s.btn, background:C.blue, width:'100%'}}>Kapat</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KRİPTO EKRANI ─────────────────────────────────────────────────────────
const TOP_CRYPTOS = [
  {sym:'BTC-USD',  name:'Bitcoin',       icon:'₿'},
  {sym:'ETH-USD',  name:'Ethereum',      icon:'Ξ'},
  {sym:'BNB-USD',  name:'BNB',           icon:'🔶'},
  {sym:'SOL-USD',  name:'Solana',        icon:'◎'},
  {sym:'XRP-USD',  name:'XRP',           icon:'✕'},
  {sym:'ADA-USD',  name:'Cardano',       icon:'₳'},
  {sym:'AVAX-USD', name:'Avalanche',     icon:'🔺'},
  {sym:'DOGE-USD', name:'Dogecoin',      icon:'🐕'},
  {sym:'DOT-USD',  name:'Polkadot',      icon:'●'},
  {sym:'MATIC-USD',name:'Polygon',       icon:'⬡'},
  {sym:'LINK-USD', name:'Chainlink',     icon:'⬡'},
  {sym:'UNI-USD',  name:'Uniswap',       icon:'🦄'},
  {sym:'LTC-USD',  name:'Litecoin',      icon:'Ł'},
  {sym:'ATOM-USD', name:'Cosmos',        icon:'⚛'},
  {sym:'XLM-USD',  name:'Stellar',       icon:'✦'},
  {sym:'ALGO-USD', name:'Algorand',      icon:'◈'},
  {sym:'VET-USD',  name:'VeChain',       icon:'✓'},
  {sym:'FIL-USD',  name:'Filecoin',      icon:'⛁'},
  {sym:'TRX-USD',  name:'TRON',          icon:'◈'},
  {sym:'NEAR-USD', name:'NEAR Protocol', icon:'◎'},
];

function CryptoScreen({ data, setData }) {
  const [prices, setPrices]   = useState({});
  const [usdTry, setUsdTry]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [currency, setCur]    = useState('USD'); // USD | TRY
  const [lastUpdate, setLU]   = useState(null);
  const favCryptos = data.settings?.favCryptos || [];

  const toggleFav = (sym) => {
    const n = favCryptos.includes(sym) ? favCryptos.filter(c=>c!==sym) : [...favCryptos, sym];
    setData(d=>({...d, settings:{...d.settings, favCryptos:n}}));
  };

  const loadPrices = async () => {
    setLoading(true);
    try {
      // USD/TRY kuru
      const rateRes = await fetch('/api/price?ticker=USDTRY%3DX').then(r=>r.json());
      const rate = rateRes.price || 1;
      setUsdTry(rate);

      // Tüm kripto fiyatları
      const tickers = TOP_CRYPTOS.map(c=>c.sym).join(',');
      const res = await fetch('/api/prices', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({tickers}),
      }).then(r=>r.json());

      setPrices(res.prices || {});
      setLU(new Date());
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadPrices(); }, []);

  const filtered = TOP_CRYPTOS.filter(c =>
    !search ||
    c.sym.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const fmt2 = (usd) => {
    if (usd == null) return '—';
    if (currency === 'TRY' && usdTry) {
      const tl = usd * usdTry;
      return `${tl >= 1000 ? fmtD(tl,0) : tl >= 1 ? fmtD(tl,2) : fmtD(tl,4)} ₺`;
    }
    return usd >= 1000 ? `$${fmtD(usd,0)}` : usd >= 1 ? `$${fmtD(usd,2)}` : `$${fmtD(usd,6)}`;
  };

  const totalPortfolio = (data.investments || []).filter(i => i.type === 'Kripto').reduce((a,i) => a + i.current*(i.adet||1), 0);

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'10px 16px 8px',background:C.card,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div>
            <span style={{fontWeight:800,fontSize:14,color:C.text}}>₿ Kripto Piyasası</span>
            {lastUpdate && <span style={{fontSize:10,color:C.muted,marginLeft:8}}>
              {lastUpdate.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}
            </span>}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {/* Para birimi toggle */}
            <div style={{display:'flex',background:C.card,borderRadius:20,padding:2}}>
              {['USD','TRY'].map(cur => (
                <button key={cur} onClick={()=>setCur(cur)}
                  style={{padding:'4px 10px',border:'none',borderRadius:18,cursor:'pointer',
                    fontWeight:700,fontSize:11,
                    background:currency===cur?C.purple:'transparent',
                    color:currency===cur?'#fff':C.muted}}>
                  {cur}
                </button>
              ))}
            </div>
            <button onClick={loadPrices} disabled={loading}
              style={{background:C.purpleBg,border:`1px solid ${C.purple}40`,borderRadius:20,
                padding:'5px 12px',color:C.purple,fontSize:11,fontWeight:700,
                cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
              {loading?<Spinner size={12} color={C.purple}/>:'↺'}
            </button>
          </div>
        </div>

        {/* Kripto portföy özeti */}
        {totalPortfolio > 0 && (
          <div style={{background:C.purpleBg,border:`1px solid ${C.purple}30`,borderRadius:12,
            padding:'8px 12px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:11,color:C.purple,fontWeight:700}}>💼 Kripto Portföyüm</span>
            <span style={{fontSize:14,fontWeight:800,color:C.purple}}>{fmt(totalPortfolio)}</span>
          </div>
        )}

        <input style={{...s.input,padding:'8px 12px'}}
          placeholder="Bitcoin, ETH, BNB..."
          value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {/* Liste */}
      <div style={{flex:1,overflowY:'auto',padding:'0 16px'}}>
        {usdTry && (
          <div style={{padding:'8px 0',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.muted}}>1 USD</span>
            <span style={{fontSize:11,fontWeight:700,color:C.text}}>{fmtD(usdTry)} ₺</span>
          </div>
        )}
        {filtered.map(crypto => {
          const info   = prices[crypto.sym];
          const price  = info?.price;
          const chg    = info?.change;
          const isFav  = favCryptos.includes(crypto.sym);
          const isUp   = (chg||0) > 0;
          const isDown = (chg||0) < 0;

          return (
            <div key={crypto.sym} style={{display:'flex',alignItems:'center',
              padding:'12px 0',borderBottom:`1px solid ${C.border}`}}>
              {/* Icon + isim */}
              <div style={{width:40,height:40,borderRadius:20,background:C.purpleBg,
                border:`1px solid ${C.purple}40`,display:'flex',alignItems:'center',
                justifyContent:'center',fontSize:16,marginRight:12,flexShrink:0}}>
                {crypto.icon}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,fontSize:14,color:C.text}}>{crypto.name}</div>
                <div style={{fontSize:11,color:C.muted}}>{crypto.sym.replace('-USD','')}</div>
              </div>
              {/* Fiyat */}
              <div style={{textAlign:'right',marginRight:10}}>
                {price != null ? (
                  <>
                    <div style={{fontWeight:800,fontSize:14,color:C.text}}>{fmt2(price)}</div>
                    {chg != null && (
                      <div style={{fontSize:11,fontWeight:700,
                        color:isUp?C.accent:isDown?C.red:C.muted}}>
                        {isUp?'▲':'▼'} %{Math.abs(chg).toFixed(2)}
                      </div>
                    )}
                  </>
                ) : (
                  loading ? <Spinner size={14} color={C.purple}/> : <span style={{color:C.border}}>—</span>
                )}
              </div>
              <button onClick={()=>toggleFav(crypto.sym)}
                style={{background:'none',border:`1px solid ${isFav?C.yellow:C.border}`,
                  borderRadius:20,padding:'5px 8px',cursor:'pointer',
                  fontSize:13,color:isFav?C.yellow:C.muted,flexShrink:0}}>
                {isFav?'⭐':'☆'}
              </button>
            </div>
          );
        })}
        <div style={{textAlign:'center',padding:'16px 0',color:C.muted,fontSize:11}}>
          {TOP_CRYPTOS.length} kripto para birimi
        </div>
      </div>
    </div>
  );
}
// ─── EKSİK OLAN VE UYGULAMAYI ÇÖKERTEN YARDIMCI BİLEŞENLER (Eklendi) ───

function CommentsSummary({ newsId, onOpenFull }) {
  return (
    <div 
      onClick={onOpenFull}
      style={{padding:'10px', background:'rgba(255,255,255,0.05)', borderRadius:'12px', marginTop:'10px', textAlign:'center', cursor:'pointer'}} 
    >
      <span style={{fontSize:12, color:C.muted, fontWeight:700}}>💬 Yorumları Gör...</span>
    </div>
  );
}

function CommentsModal({ newsId, newsTitle, user, onClose }) {
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:999, display:'flex', justifyContent:'center', alignItems:'center', padding:20}}>
      <div style={{background:C.card, border:`1px solid ${C.border}`, padding:24, borderRadius:20, width:'100%', maxWidth:400}}>
        <h3 style={{color:C.text, marginTop:0, fontSize:16}}>{newsTitle}</h3>
        <p style={{color:C.muted, fontSize:13, marginBottom:20}}>Yorum sistemi yakında eklenecek...</p>
        <button onClick={onClose} style={{...s.btn, background:C.accent, width:'100%'}}>Kapat</button>
      </div>
    </div>
  );
}

function StockDetailModal({ stock, isFav, onToggleFav, onClose }) {
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:999, display:'flex', justifyContent:'center', alignItems:'center', padding:20}}>
      <div style={{background:C.card, border:`1px solid ${C.border}`, padding:24, borderRadius:20, width:'100%', maxWidth:400}}>
        <h3 style={{color:C.text, marginTop:0, fontSize:18}}>{stock.name} ({stock.code})</h3>
        <p style={{color:C.muted, fontSize:13, marginBottom:20}}>Detaylı grafik sayfası yapım aşamasında...</p>
        <button onClick={onClose} style={{...s.btn, background:C.blue, width:'100%'}}>Kapat</button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────

// ─── ANA UYGULAMA ──────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]     = useState(undefined);
  const [tab, setTab]       = useState('home');
  const { data, setData, loading } = useUserData(user?.uid);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); window._pwaPrompt = e; };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Service Worker kaydet
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u || null));
    return unsub;
  }, []);

  // Tema ve dil uygula
  const [themeKey, setThemeKey] = useState(0);
  const [activeTheme, setActiveTheme] = useState('dark');
  useEffect(() => {
    if (!data) return;
    const theme = data.settings?.theme || 'dark';
    const lang  = data.settings?.lang  || 'tr';
    const newC = THEMES[theme] || THEMES.dark;
    const newT = LANGS[lang]   || LANGS.tr;
    // C ve T objeleri güncelle
    Object.keys(newC).forEach(k => { C[k] = newC[k]; });
    Object.keys(newT).forEach(k => { T[k] = newT[k]; });
    // s objesi yeniden hesapla (C değişti)
    // s proxy artık dinamik - C değişince otomatik güncelleniyor
    // CSS variables ile tüm ::root'u güncelle - inline stil kullanmayan yerleri de etkiler
    const root = document.documentElement;
    Object.entries(newC).forEach(([k,v]) => {
      root.style.setProperty(`--c-${k}`, v);
    });
    // Body'yi güncelle
    document.body.style.cssText = `background:${newC.bg}!important;color:${newC.text}!important;`;
    // CSS variables inject et (inline stil yerine tüm uygulama için)
    const themeRoot = document.documentElement;
    Object.keys(newC).forEach(k => themeRoot.style.setProperty(`--c-${k}`, newC[k]));
    document.body.style.background = newC.bg;
    document.body.style.color = newC.text;
    setActiveTheme(theme);
    setThemeKey(k => k + 1);
  }, [data?.settings?.theme, data?.settings?.lang]);

// Fiyat alarm kontrol
  useEffect(() => {
    // Mobil çökmeyi önleyen güvenli window.Notification kontrolü eklendi
    if (!data || typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    
    const alerts = data.settings?.priceAlerts || [];
    if (!alerts.length) return;
    const codes = alerts.map(a => a.code);
    fetch('/api/prices', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({tickers: codes.map(c => `${c}.IS`)}),
    }).then(r => r.json()).then(({prices}) => {
      alerts.forEach(alert => {
        const info = prices[alert.code];
        if (!info?.price) return;
        const triggered = alert.dir === 'ust'
          ? info.price >= alert.price
          : info.price <= alert.price;
        if (triggered) {
          new Notification(`${alert.code} Fiyat Alarmi`, {
            body: `${alert.code} ${fmtD(info.price)}₺ ${alert.dir==='ust'?'ustune cikti':'altina dustu'}! Hedef: ${fmtD(alert.price)}₺`,
            icon: '/icon-192.png',
          });
        }
      });
    }).catch(() => {});
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
    {id:'home',   icon:'◉', label:T.genel},
    {id:'news',   icon:'📰', label:T.haberler},
    {id:'stocks', icon:'📊', label:T.hisseler},
    {id:'crypto', icon:'₿',  label:'Kripto'},
    {id:'budget', icon:'₺', label:T.butce},
    {id:'invest', icon:'↑', label:T.yatirim},
    {id:'stats',  icon:'▦', label:T.analiz},
    {id:'more',   icon:'⋯', label:T.daha},
  ];

  return (
    <>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        * {-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
        body{background:${C.bg}!important;color:${C.text}!important;transition:background 0.25s,color 0.25s;}
        input,textarea,select{background:${C.card}!important;color:${C.text}!important;border-color:${C.border}!important;}
        button{transition:background 0.2s,color 0.2s;}
      `}</style>
      <div key={themeKey} style={{...s.app, background:C.bg, color:C.text}}>
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
              <span style={s.label}>{T.toplamlBakiye||'TOPLAM BAKİYE'}</span>
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
          {tab==='news'   && <NewsFeedScreen user={user} />}
          {tab==='stocks' && <StocksScreen data={data} setData={setData} />}
          {tab==='crypto' && <CryptoScreen data={data} setData={setData} />}
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