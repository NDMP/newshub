import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { Sun, Moon, RefreshCw, LogOut } from "lucide-react";
import "./index.css";
import ArticleCard from "./components/ArticleCard";
import ArticleView from "./views/ArticleView";
import AIChatbot from "./components/AIChatbot";
import LandingPage from "./views/LandingPage";
import AuthView from "./views/AuthView";
import type { Article } from "./types";
import { useTheme } from "./context/ThemeContext";

const CATEGORIES = ["All", "General", "Business", "Technology", "Sports", "Health", "Entertainment"];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  console.log("App mounting...");
  console.log("VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);
  const [articles, setArticles] = useState<Article[]>([]);
  const [category, setCategory] = useState("All");
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // NewsHub Pro States
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 12;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser({ email: session.user.email! });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email! });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchArticles = async () => {
    let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    if (!apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
    try {
      const res = await fetch(`${apiUrl}/api/articles?limit=${limit}&offset=${page * limit}&category=${category}`);
      const data = await res.json();
      setArticles(data.articles || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch articles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchArticles();
  }, [category, page, user]);

  const handleSync = async () => {
    setSyncing(true);
    let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    if (!apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
    try {
      const res = await fetch(`${apiUrl}/api/ingest`, { method: "POST" });
      const data = await res.json();
      alert(data.message || "Sync started");
      setTimeout(() => fetchArticles(), 3000);
    } catch (err) {
      alert("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setArticles([]);
    setSelectedArticleId(null);
  };

  if (!user && !showAuth) {
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  if (showAuth) {
    return <AuthView
      onAuthSuccess={(u) => { setUser(u); setShowAuth(false); }}
      onBack={() => setShowAuth(false)}
    />;
  }

  const selectedArticle = articles.find(a => a.id === selectedArticleId);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="app-container">
      <nav className="main-nav">
        <div className="logo" onClick={() => handleLogout()}>NewsHub</div>

        <div className="nav-links">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={category === cat ? "active" : ""}
              onClick={() => { setCategory(cat); setPage(0); setSelectedArticleId(null); }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="nav-actions">
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="sync-btn" onClick={handleSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Pipeline"}
          </button>
          <div className="user-pill">{user?.email.split('@')[0]}</div>
          <button className="logout-btn" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '11px' }}>
            <LogOut size={12} />
            Logout
          </button>
        </div>
      </nav>

      <main className="content-grid">
        {selectedArticle ? (
          <ArticleView
            article={selectedArticle}
            onBack={() => setSelectedArticleId(null)}
          />
        ) : (
          <>
            <div className="section-header">
              <h1>{category} News</h1>
              <p>Showing {articles.length} of {total} headlines</p>
            </div>

            {loading ? (
              <div className="loading-state">Identifying news bias...</div>
            ) : articles.length === 0 ? (
              <div className="empty-state">No articles found in this category. Try hitting Sync Pipeline.</div>
            ) : (
              <div className="articles-grid">
                {articles.map(article => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onClick={() => setSelectedArticleId(article.id)}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="pagination">
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                  <button
                    key={i}
                    className={`page-btn ${page === i ? 'active' : ''}`}
                    onClick={() => { setPage(i); window.scrollTo(0, 0); }}
                  >
                    {i + 1}
                  </button>
                ))}
                {totalPages > 5 && <span>...</span>}
              </div>
            )}
          </>
        )}
      </main>

      <AIChatbot />
    </div>
  );
}
