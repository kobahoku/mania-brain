import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle, ArrowLeft, BookOpenText, Check, ChevronRight, Home as HomeIcon, Mic, Search, Square, Trash2 } from 'lucide-react';
import './styles.css';

type Screen = 'home' | 'recording' | 'confirm' | 'knowledge';
type Memo = {
  id: string;
  category: string;
  title: string;
  content: string;
  rawTranscript: string;
  createdAt: string;
  updatedAt: string;
  source: 'voice' | 'text';
};
type Draft = Pick<Memo, 'category' | 'title' | 'content' | 'rawTranscript' | 'source'> & { id?: string };

const STORAGE_KEY = 'mania-brain:memos:v1';
const seedMemos: Memo[] = [];

function loadMemos(): Memo[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : seedMemos;
  } catch {
    return seedMemos;
  }
}

function organizeTranscript(raw: string): Draft {
  const content = raw.trim().replace(/\s+/g, '');
  const rules: [string, RegExp][] = [
    ['発注', /発注|注文|納品|業者|仕入/],
    ['営業前準備', /営業前|開店|解凍|準備|補充|在庫|予約/],
    ['仕込み', /仕込|煮込|茹で|切る|混ぜ|餡|タレ|スープ/],
    ['清掃・衛生', /清掃|掃除|洗浄|消毒|衛生|油|グリスト/],
    ['接客', /接客|お客様|案内|満席|予約|提供|会計/],
    ['保管場所', /冷蔵庫|冷凍庫|ストッカー|棚|保管|左下|右奥/],
  ];
  const category = rules.find(([, pattern]) => pattern.test(content))?.[0] ?? 'その他';
  const subjects = ['餃子', 'スープ', 'ビール', '冷蔵庫', '冷凍庫', '発注', '仕込み', '清掃'];
  const subject = subjects.find((item) => content.includes(item));
  const action = content.match(/(解凍|発注|補充|清掃|保管|仕込み|温度管理|在庫確認)/)?.[1];
  const title = subject ? `${subject}${action ? `の${action}` : 'について'}` : content.replace(/[。！？].*$/, '').slice(0, 22) || '新しい店舗メモ';
  return { category, title, content: /[。！？]$/.test(content) ? content : `${content}。`, rawTranscript: raw, source: 'voice' };
}

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(false);
  const [memos, setMemos] = useState<Memo[]>(loadMemos);
  const [draft, setDraft] = useState<Draft>(organizeTranscript(''));

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(memos)), [memos]);
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return memos
      .filter((memo) => `${memo.category}${memo.title}${memo.content}`.toLowerCase().includes(normalized))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [memos, query]);

  const todayCount = memos.filter((memo) => new Date(memo.createdAt).toDateString() === new Date().toDateString()).length;
  const lastMemo = [...memos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const saveMemo = () => {
    const now = new Date().toISOString();
    setMemos((items) => draft.id
      ? items.map((memo) => memo.id === draft.id ? { ...memo, ...draft, updatedAt: now } as Memo : memo)
      : [{ ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as Memo, ...items]);
    setSaved(true);
    window.setTimeout(() => { setSaved(false); setScreen('home'); }, 700);
  };

  const deleteMemo = () => {
    if (!draft.id) return;
    setMemos((items) => items.filter((memo) => memo.id !== draft.id));
    setScreen('knowledge');
  };

  return <main className="app-shell"><div className="phone">
    {screen === 'home' && <HomeScreen count={todayCount} lastMemo={lastMemo} onRecord={() => setScreen('recording')} onKnowledge={() => setScreen('knowledge')} />}
    {screen === 'recording' && <RecordingScreen onCancel={() => setScreen('home')} onComplete={(raw) => { setDraft(organizeTranscript(raw)); setScreen('confirm'); }} />}
    {screen === 'confirm' && <ConfirmScreen draft={draft} setDraft={setDraft} onBack={() => setScreen(draft.id ? 'knowledge' : 'recording')} onSave={saveMemo} onDelete={draft.id ? deleteMemo : undefined} saved={saved} />}
    {screen === 'knowledge' && <KnowledgeScreen query={query} setQuery={setQuery} memos={filtered} onHome={() => setScreen('home')} onSelect={(memo) => { setDraft(memo); setScreen('confirm'); }} />}
  </div></main>;
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><Mic size={24} strokeWidth={2.4} /></span><strong>MANIA BRAIN</strong></div>;
}

function HomeScreen({ count, lastMemo, onRecord, onKnowledge }: { count: number; lastMemo?: Memo; onRecord: () => void; onKnowledge: () => void }) {
  return <section className="screen home-screen">
    <header className="topbar"><Brand /><button className="icon-button" aria-label="知識一覧を開く" onClick={onKnowledge}><BookOpenText /></button></header>
    <div className="home-copy"><p>今日のメモ</p><div><strong>{count}</strong><span>件</span></div></div>
    <div className="record-area"><button className="record-button" aria-label="録音を開始" onClick={onRecord}><Mic size={54} strokeWidth={2.1} /></button><h1>タップして話す</h1><p>思いついた瞬間を、そのまま。</p></div>
    {lastMemo && <button className="recent" onClick={onKnowledge}><span>最後のメモ</span><strong>{lastMemo.title}</strong><span>{formatTime(lastMemo.updatedAt)}</span></button>}
    <BottomNav active="home" onHome={() => {}} onKnowledge={onKnowledge} />
  </section>;
}

function RecordingScreen({ onCancel, onComplete }: { onCancel: () => void; onComplete: (text: string) => void }) {
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<'starting' | 'listening' | 'unsupported' | 'error'>('starting');
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef('');
  const watchdogRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    const start = async () => {
      try {
        const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !Recognition) { setStatus('unsupported'); return; }
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recognition = new Recognition();
        recognition.lang = 'ja-JP'; recognition.continuous = true; recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0].transcript;
          transcriptRef.current = text;
          if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
          if (active) setTranscript(text);
        };
        recognition.onerror = () => active && setStatus('error');
        recognition.onend = () => { if (active && recognitionRef.current) try { recognition.start(); } catch {} };
        recognitionRef.current = recognition; recognition.start(); setStatus('listening');
        watchdogRef.current = window.setTimeout(() => {
          if (active && !transcriptRef.current.trim()) {
            recognitionRef.current?.stop();
            streamRef.current?.getTracks().forEach((track) => track.stop());
            setStatus('error');
          }
        }, 8000);
      } catch { if (active) setStatus('error'); }
    };
    start();
    return () => { active = false; clearInterval(timer); if (watchdogRef.current) clearTimeout(watchdogRef.current); recognitionRef.current?.stop(); recognitionRef.current = null; streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, []);

  const stop = () => {
    recognitionRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    onComplete(transcript || '新しい店舗メモ');
  };

  return <section className="screen recording-screen">
    <header className="center-header"><button className="back-button" onClick={onCancel}><ArrowLeft />戻る</button><h1>{status === 'unsupported' ? 'メモ入力' : '録音中'}</h1><span /></header>
    {status !== 'unsupported' && <><div className={`wave ${status !== 'listening' ? 'paused' : ''}`} aria-label="録音波形">{[8,18,31,48,70,38,58,82,44,28,64,86,52,34,17,9].map((height, index) => <i key={index} style={{ height }} />)}</div><div className="timer">{formatDuration(seconds)}</div><button className="stop-button" aria-label="録音を停止" onClick={stop}><Square fill="currentColor" size={34} /></button><p className="stop-label">話し終わったらタップ</p></>}
    {status === 'unsupported' && <div className="permission-note unsupported-note"><AlertCircle /><div><strong>このブラウザでは自動文字起こしを使えません</strong><p>ChromeまたはSafariで安全な公開URLを開くと、音声入力を利用できます。ここでは手入力で保存できます。</p></div></div>}
    {status === 'error' && <div className="permission-note"><AlertCircle /><div><strong>自動文字起こしを開始できませんでした</strong><p>このブラウザでは音声認識結果が返りません。下の欄へ入力するか、公開後にChrome・Safariでお試しください。</p></div></div>}
    <div className={`transcript ${status === 'unsupported' ? 'manual' : ''}`}><span>{status === 'unsupported' ? '内容を入力' : '文字起こし'}</span><textarea aria-label="メモ内容" placeholder="ここに話した内容が表示されます" value={transcript} onChange={(event) => { transcriptRef.current = event.target.value; setTranscript(event.target.value); }} /></div>
    {(status === 'unsupported' || status === 'error') && <button className="continue-button" disabled={!transcript.trim()} onClick={stop}>AI整理へ進む</button>}
  </section>;
}

function ConfirmScreen({ draft, setDraft, onBack, onSave, onDelete, saved }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>>; onBack: () => void; onSave: () => void; onDelete?: () => void; saved: boolean }) {
  return <section className="screen confirm-screen">
    <header className="center-header"><button className="back-button" onClick={onBack}><ArrowLeft />戻る</button><h1>{draft.id ? 'メモを編集' : 'AIが整理しました'}</h1>{onDelete ? <button className="delete-icon" aria-label="メモを削除" onClick={onDelete}><Trash2 /></button> : <span />}</header>
    {!draft.id && <div className="ai-note"><span className="spark">✦</span><p>内容を確認して、そのまま保存できます</p></div>}
    <form className="form" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <label>カテゴリ<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option>営業前準備</option><option>仕込み</option><option>発注</option><option>接客</option><option>清掃・衛生</option><option>保管場所</option><option>その他</option></select></label>
      <label>タイトル<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label>内容<textarea required value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} /></label>
      <button className={`save-button ${saved ? 'saved' : ''}`} type="submit">{saved ? <><Check />保存しました</> : draft.id ? '変更を保存' : '保存する'}</button>
    </form>
  </section>;
}

function KnowledgeScreen({ query, setQuery, memos, onHome, onSelect }: { query: string; setQuery: (query: string) => void; memos: Memo[]; onHome: () => void; onSelect: (memo: Memo) => void }) {
  return <section className="screen knowledge-screen">
    <header className="list-header"><h1>知識一覧</h1><p>{memos.length}件の店舗ノウハウ</p></header>
    <label className="search"><Search size={21} /><input placeholder="キーワードで検索" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="memo-list">{memos.length ? memos.map((memo) => <button className="memo-row" key={memo.id} onClick={() => onSelect(memo)}><span className="category">{memo.category}</span><time>{formatTime(memo.updatedAt)}</time><strong>{memo.title}</strong><p>{memo.content}</p><ChevronRight className="chevron" /></button>) : <div className="empty-state"><Search /><strong>該当するメモがありません</strong><p>別の言葉で検索してみてください。</p></div>}</div>
    <BottomNav active="knowledge" onHome={onHome} onKnowledge={() => {}} />
  </section>;
}

function BottomNav({ active, onHome, onKnowledge }: { active: string; onHome: () => void; onKnowledge: () => void }) {
  return <nav className="bottom-nav"><button className={active === 'home' ? 'active' : ''} onClick={onHome}><HomeIcon /><span>ホーム</span></button><button className={active === 'knowledge' ? 'active' : ''} onClick={onKnowledge}><BookOpenText /><span>知識一覧</span></button></nav>;
}

function formatTime(value: string) {
  const date = new Date(value); const now = new Date();
  if (date.toDateString() === now.toDateString()) return `今日 ${date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}
function formatDuration(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
