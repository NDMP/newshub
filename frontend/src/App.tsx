import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import {
  Sun, Moon, RefreshCw, LogOut,
  GitBranch, Globe, GraduationCap, Mail,
  Newspaper, ChevronRight, User, MessageSquare, X,
  Bookmark, LayoutDashboard, ShieldCheck, Bell, Headphones,
  Search
} from "lucide-react";
import "./index.css";
import ArticleCard        from "./components/ArticleCard";
import ArticleView        from "./views/ArticleView";
import AIChatbot          from "./components/AIChatbot";
import LandingPage        from "./views/LandingPage";
import AuthView           from "./views/AuthView";
import NarrativesPage     from "./pages/NarrativesPage";
import ComparePage        from "./pages/ComparePage";
import InterviewModePage  from "./pages/InterviewModePage";
import NewsletterPage     from "./pages/NewsletterPage";
import SavedPage          from "./pages/SavedPage";
import DashboardPage      from "./pages/DashboardPage";
import FactCheckPage      from "./pages/FactCheckPage";
import AudioBriefingPage  from "./pages/AudioBriefingPage";
import AlertsPage         from "./pages/AlertsPage";
import type { Article }   from "./types";
import { useTheme }       from "./context/ThemeContext";

const CATEGORIES = ["All","General","Business","Technology","Sports","Health","Entertainment"];

// ── i18n translations ─────────────────────────────────────────────────────────
export type Lang = 'en' | 'ta' | 'hi';

export const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  en: {
    feed: 'Feed', intelligence: 'Intelligence', personal: 'Personal',
    storyThreads: 'Story Threads', compareNews: 'Compare News',
    newsQuiz: 'News Quiz', myNewsletter: 'My Newsletter',
    saved: 'Saved', myDashboard: 'My Dashboard',
    factChecker: 'Fact Checker', audioBriefing: 'Audio Briefing',
    newsAlerts: 'News Alerts', syncFeed: 'Sync Feed',
    syncing: 'Syncing…', lightMode: 'Light Mode', darkMode: 'Dark Mode',
    searchPlaceholder: 'Search news…', topNews: 'Top News',
    articles: 'articles', askAI: 'Ask AI',
    trackHowNewsEvolves: 'Track how news evolves',
    seeDifferentViewpoints: 'See different viewpoints',
    testYourKnowledge: 'Test your knowledge',
    getNewsInYourInbox: 'Get news in your inbox',
    yourReadingList: 'Your reading list',
    yourReadingInsights: 'Your reading insights',
    verifyAnyClaim: 'Verify any claim',
    hearTodaysNews: "Hear today's news",
    breakingNewsForYou: 'Breaking news for you',
  },
  ta: {
    feed: 'செய்திகள்', intelligence: 'அறிவுசார்', personal: 'தனிப்பட்ட',
    storyThreads: 'கதை நூல்கள்', compareNews: 'செய்தி ஒப்பீடு',
    newsQuiz: 'செய்தி வினாடி வினா', myNewsletter: 'என் நியூஸ்லெட்டர்',
    saved: 'சேமிக்கப்பட்டவை', myDashboard: 'என் டாஷ்போர்டு',
    factChecker: 'உண்மை சரிபார்ப்பு', audioBriefing: 'ஆடியோ பிரீஃபிங்',
    newsAlerts: 'செய்தி அலெர்ட்', syncFeed: 'புதுப்பி',
    syncing: 'புதுப்பிக்கிறது…', lightMode: 'வெளிர் பயன்முறை', darkMode: 'இருண்ட பயன்முறை',
    searchPlaceholder: 'செய்தி தேடு…', topNews: 'முக்கிய செய்திகள்',
    articles: 'கட்டுரைகள்', askAI: 'AI கேள்',
    trackHowNewsEvolves: 'செய்தி வளர்ச்சியை கண்காணி',
    seeDifferentViewpoints: 'வெவ்வேறு கண்ணோட்டங்கள்',
    testYourKnowledge: 'அறிவை சோதி',
    getNewsInYourInbox: 'மின்னஞ்சலில் செய்தி பெறு',
    yourReadingList: 'உங்கள் வாசிப்பு பட்டியல்',
    yourReadingInsights: 'வாசிப்பு நுண்ணறிவு',
    verifyAnyClaim: 'எந்த கூற்றையும் சரிபார்',
    hearTodaysNews: 'இன்றைய செய்தியை கேளுங்கள்',
    breakingNewsForYou: 'உடனடி செய்திகள்',
  },
  hi: {
    feed: 'फ़ीड', intelligence: 'इंटेलिजेंस', personal: 'व्यक्तिगत',
    storyThreads: 'स्टोरी थ्रेड्स', compareNews: 'समाचार तुलना',
    newsQuiz: 'समाचार प्रश्नोत्तरी', myNewsletter: 'मेरा न्यूज़लेटर',
    saved: 'सहेजा गया', myDashboard: 'मेरा डैशबोर्ड',
    factChecker: 'तथ्य जाँच', audioBriefing: 'ऑडियो ब्रीफिंग',
    newsAlerts: 'समाचार अलर्ट', syncFeed: 'सिंक करें',
    syncing: 'सिंक हो रहा है…', lightMode: 'लाइट मोड', darkMode: 'डार्क मोड',
    searchPlaceholder: 'समाचार खोजें…', topNews: 'मुख्य समाचार',
    articles: 'लेख', askAI: 'AI से पूछें',
    trackHowNewsEvolves: 'समाचार विकास को ट्रैक करें',
    seeDifferentViewpoints: 'अलग दृष्टिकोण देखें',
    testYourKnowledge: 'अपना ज्ञान परखें',
    getNewsInYourInbox: 'इनबॉक्स में समाचार पाएं',
    yourReadingList: 'आपकी पढ़ने की सूची',
    yourReadingInsights: 'पढ़ने की जानकारी',
    verifyAnyClaim: 'किसी भी दावे की जाँच करें',
    hearTodaysNews: 'आज की खबर सुनें',
    breakingNewsForYou: 'ब्रेकिंग न्यूज़',
  },
};

export const useLang = () => {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('nh_lang') as Lang) || 'en');
  const setLanguage = (l: Lang) => { setLang(l); localStorage.setItem('nh_lang', l); };
  const t = (key: string) => TRANSLATIONS[lang][key] || TRANSLATIONS['en'][key] || key;
  return { lang, setLanguage, t };
};

type PageView =
  | 'home' | 'narratives' | 'compare' | 'interview' | 'newsletter'
  | 'saved' | 'dashboard' | 'factcheck' | 'audio' | 'alerts';

interface UserInfo { id: string; email: string; }

const TOOLS: { id: PageView; label: string; icon: any; description: string; section: string }[] = [
  { id: 'narratives', label: 'Story Threads', icon: GitBranch,      description: 'Track how news evolves',   section: 'intelligence' },
  { id: 'compare',    label: 'Compare News',  icon: Globe,           description: 'See different viewpoints', section: 'intelligence' },
  { id: 'interview',  label: 'News Quiz',     icon: GraduationCap,   description: 'Test your knowledge',      section: 'intelligence' },
  { id: 'newsletter', label: 'My Newsletter', icon: Mail,            description: 'Get news in your inbox',   section: 'intelligence' },
  { id: 'saved',      label: 'Saved',         icon: Bookmark,        description: 'Your reading list',        section: 'personal' },
  { id: 'dashboard',  label: 'My Dashboard',  icon: LayoutDashboard, description: 'Your reading insights',    section: 'personal' },
  { id: 'factcheck',  label: 'Fact Checker',  icon: ShieldCheck,     description: 'Verify any claim',         section: 'personal' },
  { id: 'audio',      label: 'Audio Briefing',icon: Headphones,      description: "Hear today's news",        section: 'personal' },
  { id: 'alerts',     label: 'News Alerts',   icon: Bell,            description: 'Breaking news for you',    section: 'personal' },
];

const getAPI = () => {
  let u = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  return u.startsWith('http') ? u : `https://${u}`;
};

// Pages that render INSIDE the shell (show topbar + sidebar)
const SHELL_PAGES: PageView[] = ['home', 'saved', 'dashboard', 'factcheck', 'audio', 'alerts'];
// Pages that render FULL SCREEN (have their own layout)
const FULLSCREEN_PAGES: PageView[] = ['narratives', 'compare', 'interview', 'newsletter'];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLanguage, t } = useLang();

  const [articles,          setArticles]          = useState<Article[]>([]);
  const [category,          setCategory]          = useState("All");
  const [searchQuery,       setSearchQuery]       = useState('');
  const [searchInput,       setSearchInput]       = useState('');
  const searchDebounce      = useRef<any>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [loading,           setLoading]           = useState(true);
  const [syncing,           setSyncing]           = useState(false);
  const [currentPage,       setCurrentPage]       = useState<PageView>('home');
  const [sidebarCollapsed,  setSidebarCollapsed]  = useState(false);
  const [chatOpen,          setChatOpen]          = useState(false);
  const [page,              setPage]              = useState(0);
  const [total,             setTotal]             = useState(0);
  const [user,              setUser]              = useState<UserInfo | null>(null);
  const [showAuth,          setShowAuth]          = useState(false);
  const [savedIds,          setSavedIds]          = useState<Set<number>>(new Set());
  const [alertCount,        setAlertCount]        = useState(0);
  const limit = 12;

  // Search debounce — wait 400ms after user stops typing
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearchQuery(val.trim());
      setPage(0);
    }, 400);
  };

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser({ id: session.user.id, email: session.user.email! });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email! } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Articles
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const res  = await fetch(`${getAPI()}/api/articles?limit=${limit}&offset=${page * limit}&category=${category}${searchParam}`);
      const data = await res.json();
      // Fix 3: Deduplicate by article ID — prevent same article appearing under multiple categories
      const seen = new Set<number>();
      const unique = (data.articles || []).filter((a: Article) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
      setArticles(unique);
      setTotal(data.total || 0);
    } catch { /* silent */ }
    finally  { setLoading(false); }
  }, [category, page, searchQuery]);

  useEffect(() => { if (user) fetchArticles(); }, [category, page, searchQuery, user]);

  // Saved IDs
  useEffect(() => {
    if (!user) return;
    fetch(`${getAPI()}/api/features/saved?user_id=${user.id}`)
      .then(r => r.json())
      .then(d => {
        const ids = new Set<number>((d.articles || []).map((s: any) => s.articles?.id).filter(Boolean));
        setSavedIds(ids);
      }).catch(() => {});
  }, [user]);

  // Alert count from localStorage
  useEffect(() => {
    const sync = () => setAlertCount(parseInt(localStorage.getItem('nh_alert_count') || '0'));
    sync();
    const iv = setInterval(sync, 30000);
    return () => clearInterval(iv);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res  = await fetch(`${getAPI()}/api/ingest`, { method: "POST" });
      const data = await res.json();
      alert(data.message || "Sync started");
      setTimeout(fetchArticles, 3000);
    } catch { alert("Sync failed"); }
    finally  { setSyncing(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setArticles([]); setSelectedArticleId(null); setCurrentPage('home');
    localStorage.removeItem('nh_alert_count');
    localStorage.removeItem('nh_alert_keywords');
    localStorage.removeItem('nh_last_checked');
  };

  const toggleSave = async (articleId: number) => {
    if (!user) return;
    const isSaved = savedIds.has(articleId);
    if (isSaved) {
      await fetch(`${getAPI()}/api/features/save`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, article_id: articleId }),
      });
      setSavedIds(prev => { const n = new Set(prev); n.delete(articleId); return n; });
    } else {
      await fetch(`${getAPI()}/api/features/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, article_id: articleId }),
      });
      setSavedIds(prev => new Set([...prev, articleId]));
    }
  };

  const trackRead = (articleId: number) => {
    if (!user) return;
    fetch(`${getAPI()}/api/features/read`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, article_id: articleId, read_secs: 60 }),
    }).catch(() => {});
  };

  const goHome = () => {
    setCurrentPage('home');
    setSelectedArticleId(null);
  };

  const displayName = (user?.email.split('@')[0] || '')
    .replace(/[._\-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  /* ── Gates ── */
  if (!user && !showAuth) return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  if (showAuth) return (
    <AuthView onAuthSuccess={u => { setUser(u as any); setShowAuth(false); }} onBack={() => setShowAuth(false)} />
  );

  /* ── Full-screen pages (have their own complete layout) ── */
  if (FULLSCREEN_PAGES.includes(currentPage)) {
    return (
      <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <aside className="app-sidebar">
          <Sidebar
            sidebarCollapsed={sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            category={category}
            setCategory={setCategory}
            setPage={setPage}
            setSelectedArticleId={setSelectedArticleId}
            alertCount={alertCount}
            setAlertCount={setAlertCount}
            theme={theme}
            toggleTheme={toggleTheme}
            syncing={syncing}
            handleSync={handleSync}
            handleLogout={handleLogout}
            displayName={displayName}
            userEmail={user?.email || ''}
            goHome={goHome}
            lang={lang}
            setLanguage={setLanguage}
            t={t}
          />
        </aside>
        <div className="app-body">
          <div className="app-workspace">
            <div className="app-feed">
              {currentPage === 'narratives' && <NarrativesPage    onBack={goHome} />}
              {currentPage === 'compare'    && <ComparePage       onBack={goHome} />}
              {currentPage === 'interview'  && <InterviewModePage onBack={goHome} userId={user?.id} />}
              {currentPage === 'newsletter' && <NewsletterPage    onBack={goHome} userEmail={user?.email} />}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main shell (home + personal feature pages) ── */
  const selectedArticle = articles.find(a => a.id === selectedArticleId);
  const totalPages      = Math.ceil(total / limit);
  const isFeaturePage   = currentPage !== 'home';

  // Page title for topbar
  const pageTitle = (() => {
    if (currentPage === 'home') return selectedArticle ? selectedArticle.source : `${category === 'All' ? 'Top' : category} News`;
    return TOOLS.find(t => t.id === currentPage)?.label || '';
  })();

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>

      {/* ══ SIDEBAR ══ */}
      <aside className="app-sidebar">
        <Sidebar
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          category={category}
          setCategory={setCategory}
          setPage={setPage}
          setSelectedArticleId={setSelectedArticleId}
          alertCount={alertCount}
          setAlertCount={setAlertCount}
          theme={theme}
          toggleTheme={toggleTheme}
          syncing={syncing}
          handleSync={handleSync}
          handleLogout={handleLogout}
          displayName={displayName}
          userEmail={user?.email || ''}
          goHome={goHome}
          lang={lang}
          setLanguage={setLanguage}
          t={t}
        />
      </aside>

      {/* ══ MAIN BODY ══ */}
      <div className="app-body">

        {/* Topbar — shown on all pages */}
        <header className="app-topbar">
          <div className="topbar-left">
            {isFeaturePage && (
              <button className="topbar-back-btn" onClick={goHome} title="Back to home">
                <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
              </button>
            )}
            <h1 className="topbar-title">{pageTitle}</h1>
            {currentPage === 'home' && !selectedArticle && (
              <span className="topbar-count">{total} {t('articles')}</span>
            )}
          </div>
          <div className="topbar-right">
            {/* ── Search bar — only on home feed, not in article view ── */}
            {currentPage === 'home' && !selectedArticle && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => handleSearchInput(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  style={{
                    paddingLeft: 30, paddingRight: searchInput ? 28 : 12,
                    paddingTop: 7, paddingBottom: 7,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 12, color: 'var(--text-primary)',
                    outline: 'none', width: 200, transition: 'border-color 0.2s, width 0.2s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.width = '240px'; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border)';      e.currentTarget.style.width = '200px'; }}
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(0); }}
                    style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
            {currentPage === 'home' && !selectedArticle && totalPages > 1 && (
              <div className="topbar-pages">
                {Array.from({ length: Math.min(totalPages, 6) }).map((_, i) => (
                  <button key={i} className={`tpage-btn${page === i ? ' active' : ''}`}
                    onClick={() => { setPage(i); window.scrollTo(0, 0); }}>
                    {i + 1}
                  </button>
                ))}
                {totalPages > 6 && <span className="tpage-more">…{totalPages}</span>}
              </div>
            )}
            <button className={`chat-toggle-btn${chatOpen ? ' open' : ''}`} onClick={() => setChatOpen(o => !o)}>
              {chatOpen ? <X size={16} /> : <MessageSquare size={16} />}
              {!chatOpen && <span>{t('askAI')}</span>}
            </button>
          </div>
        </header>

        {/* Content + optional chat */}
        <div className={`app-workspace${chatOpen && !isFeaturePage ? ' with-chat' : ''}`}>
          <div className="app-feed">

            {/* ── HOME PAGE ── */}
            {currentPage === 'home' && (
              selectedArticle ? (
                <ArticleView article={selectedArticle} onBack={() => setSelectedArticleId(null)} />
              ) : loading ? (
                <div className="feed-loading-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 0.07}s` }}>
                      <div className="skeleton-img" />
                      <div className="skeleton-body">
                        <div className="skeleton-line" style={{ width: '90%' }} />
                        <div className="skeleton-line" style={{ width: '60%' }} />
                        <div className="skeleton-line" style={{ width: '75%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : articles.length === 0 ? (
                <div className="feed-empty">
                  <div className="feed-empty-icon">📭</div>
                  <h3>No articles yet</h3>
                  <p>Click <strong>Sync Feed</strong> in the sidebar to pull the latest news.</p>
                </div>
              ) : (
                <div className="articles-grid">
                  {articles.map((article, idx) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      index={idx}
                      onClick={() => { setSelectedArticleId(article.id); trackRead(article.id); }}
                      isSaved={savedIds.has(article.id)}
                      onSave={() => toggleSave(article.id)}
                    />
                  ))}
                </div>
              )
            )}

            {/* ── FEATURE PAGES — rendered inline, keeping sidebar + topbar ── */}
            {currentPage === 'saved' && (
              <SavedPage
                onBack={goHome}
                userId={user?.id || ''}
                onUnsave={(id) => setSavedIds(prev => { const n = new Set(prev); n.delete(id); return n; })}
              />
            )}
            {currentPage === 'dashboard' && (
              <DashboardPage onBack={goHome} userId={user?.id || ''} userEmail={user?.email || ''} />
            )}
            {currentPage === 'factcheck' && (
              <FactCheckPage onBack={goHome} />
            )}
            {currentPage === 'audio' && (
              <AudioBriefingPage onBack={goHome} userId={user?.id || ''} userEmail={user?.email || ''} />
            )}
            {currentPage === 'alerts' && (
              <AlertsPage onBack={goHome} userId={user?.id || ''} onAlertCountChange={setAlertCount} />
            )}

          </div>

          {chatOpen && !isFeaturePage && (
            <div className="chat-side-panel">
              <AIChatbot onClose={() => setChatOpen(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SIDEBAR — extracted component so it can be reused
══════════════════════════════════════════════════════════════ */
interface SidebarProps {
  sidebarCollapsed:    boolean;
  setSidebarCollapsed: (v: (c: boolean) => boolean) => void;
  currentPage:         PageView;
  setCurrentPage:      (p: PageView) => void;
  category:            string;
  setCategory:         (c: string) => void;
  setPage:             (p: number) => void;
  setSelectedArticleId:(id: number | null) => void;
  alertCount:          number;
  setAlertCount:       (n: number) => void;
  theme:               string;
  toggleTheme:         () => void;
  syncing:             boolean;
  handleSync:          () => void;
  handleLogout:        () => void;
  displayName:         string;
  userEmail:           string;
  goHome:              () => void;
  lang:                Lang;
  setLanguage:         (l: Lang) => void;
  t:                   (k: string) => string;
}

function Sidebar({
  sidebarCollapsed, setSidebarCollapsed, currentPage, setCurrentPage,
  category, setCategory, setPage, setSelectedArticleId,
  alertCount, setAlertCount, theme, toggleTheme,
  syncing, handleSync, handleLogout, displayName, userEmail, goHome,
  lang, setLanguage, t,
}: SidebarProps) {

  const TOOL_KEYS: Record<string, { labelKey: string; descKey: string }> = {
    narratives: { labelKey: 'storyThreads',  descKey: 'trackHowNewsEvolves' },
    compare:    { labelKey: 'compareNews',   descKey: 'seeDifferentViewpoints' },
    interview:  { labelKey: 'newsQuiz',      descKey: 'testYourKnowledge' },
    newsletter: { labelKey: 'myNewsletter',  descKey: 'getNewsInYourInbox' },
    saved:      { labelKey: 'saved',         descKey: 'yourReadingList' },
    dashboard:  { labelKey: 'myDashboard',   descKey: 'yourReadingInsights' },
    factcheck:  { labelKey: 'factChecker',   descKey: 'verifyAnyClaim' },
    audio:      { labelKey: 'audioBriefing', descKey: 'hearTodaysNews' },
    alerts:     { labelKey: 'newsAlerts',    descKey: 'breakingNewsForYou' },
  };

  const intelligenceTools = TOOLS.filter(tool => tool.section === 'intelligence');
  const personalTools     = TOOLS.filter(tool => tool.section === 'personal');

  const LANG_FLAGS: Record<Lang, string> = { en: '🇬🇧', ta: '🇮🇳', hi: '🇮🇳' };
  const LANG_LABELS: Record<Lang, string> = { en: 'EN', ta: 'தமிழ்', hi: 'हिंदी' };

  return (
    <>
      <div className="sidebar-logo-row">
        {!sidebarCollapsed && (
          <button className="sidebar-brand-btn" onClick={goHome}>NewsHub</button>
        )}
        <button className="sidebar-toggle-btn" onClick={() => setSidebarCollapsed(c => !c)}>
          <ChevronRight size={14} className={sidebarCollapsed ? '' : 'rotated'} />
        </button>
      </div>

      <div className="sidebar-scroll">

        {!sidebarCollapsed && <div className="sidebar-section-label">{t('feed')}</div>}
        <nav className="sidebar-nav">
          {CATEGORIES.map(cat => (
            <button key={cat}
              className={`snav-btn${category === cat && currentPage === 'home' ? ' active' : ''}`}
              onClick={() => { setCategory(cat); setPage(0); setSelectedArticleId(null); setCurrentPage('home'); }}
              title={cat}
            >
              <Newspaper size={14} className="snav-icon" />
              {!sidebarCollapsed && <span className="snav-label">{cat}</span>}
            </button>
          ))}
        </nav>

        {!sidebarCollapsed && <div className="sidebar-section-label" style={{ marginTop: 10 }}>{t('intelligence')}</div>}
        <nav className="sidebar-nav" style={{ marginTop: sidebarCollapsed ? 8 : 0 }}>
          {intelligenceTools.map(({ id, icon: Icon }) => {
            const keys = TOOL_KEYS[id];
            return (
              <button key={id}
                className={`snav-btn tool${currentPage === id ? ' active' : ''}`}
                onClick={() => setCurrentPage(id)}
                title={t(keys.labelKey)}
              >
                <Icon size={14} className="snav-icon" />
                {!sidebarCollapsed && (
                  <div className="snav-tool-text">
                    <span className="snav-label">{t(keys.labelKey)}</span>
                    <span className="snav-desc">{t(keys.descKey)}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {!sidebarCollapsed && <div className="sidebar-section-label" style={{ marginTop: 10 }}>{t('personal')}</div>}
        <nav className="sidebar-nav" style={{ marginTop: sidebarCollapsed ? 8 : 0 }}>
          {personalTools.map(({ id, icon: Icon }) => {
            const keys = TOOL_KEYS[id];
            return (
              <button key={id}
                className={`snav-btn tool${currentPage === id ? ' active' : ''}`}
                onClick={() => {
                  setCurrentPage(id);
                  if (id === 'alerts') {
                    setAlertCount(0);
                    localStorage.setItem('nh_alert_count', '0');
                  }
                }}
                title={t(keys.labelKey)}
              >
                <Icon size={14} className="snav-icon" />
                {!sidebarCollapsed && (
                  <div className="snav-tool-text">
                    <span className="snav-label">{t(keys.labelKey)}</span>
                    <span className="snav-desc">{t(keys.descKey)}</span>
                  </div>
                )}
                {id === 'alerts' && alertCount > 0 && (
                  <span className="snav-badge">{alertCount > 9 ? '9+' : alertCount}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        {/* ── Language switcher ── */}
        {!sidebarCollapsed && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 6, padding: '0 8px' }}>
            {(['en', 'ta', 'hi'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLanguage(l)} style={{
                flex: 1, padding: '5px 4px', borderRadius: 6, border: `1px solid ${lang === l ? 'var(--accent-blue)' : 'var(--border)'}`,
                background: lang === l ? 'rgba(79,124,255,0.12)' : 'var(--bg-elevated)',
                color: lang === l ? 'var(--accent-blue)' : 'var(--text-muted)',
                fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {LANG_FLAGS[l]} {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        )}
        <button className="sfooter-btn" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {!sidebarCollapsed && <span>{theme === 'dark' ? t('lightMode') : t('darkMode')}</span>}
        </button>
        <button className="sfooter-btn teal" onClick={handleSync} disabled={syncing}>
          <RefreshCw size={14} className={syncing ? 'spin' : ''} />
          {!sidebarCollapsed && <span>{syncing ? t('syncing') : t('syncFeed')}</span>}
        </button>
        <div className="sidebar-user-card">
          <div className="suc-avatar"><User size={12} /></div>
          {!sidebarCollapsed && (
            <div className="suc-info">
              <span className="suc-name">{displayName}</span>
              <span className="suc-email">{userEmail}</span>
            </div>
          )}
          <button className="suc-logout" onClick={handleLogout} title="Sign out">
            <LogOut size={12} />
          </button>
        </div>
      </div>
    </>
  );
}
