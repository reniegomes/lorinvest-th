import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { 
  LayoutDashboard, 
  Star, 
  RefreshCw, 
  Plus, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  Tag, 
  AlertCircle, 
  GripVertical, 
  LogOut, 
  Settings, 
  Globe, 
  Shield, 
  Search, 
  User, 
  Building2,
  ChevronRight,
  Filter,
  X,
  CheckCircle2,
  TrendingUp,
  Newspaper
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Interfaces ---
interface UserProfile {
  name: string;
  companyName: string;
  industry: string;
}

interface Article {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string; 
  date: string; 
  categoryId: string;
  columnId?: string;
  isFavorite?: boolean;
}

type DatePreset = '24h' | '7d' | '1M' | '3M' | 'Tudo' | 'Custom';

interface Column {
  id: string;
  title: string;
  keywords: string[];
  negativeKeywords: string[];
  datePreset: DatePreset;
  customStartDate?: string;
  customEndDate?: string;
}

interface Category {
  id: string;
  title: string;
  sources: string[]; 
  negativeTerms: string[];
  columns: Column[];
}

// --- Constants ---
const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'logistica', 
    title: 'Logística & Navegação', 
    sources: ['portosenavios.com.br', 'valor.com.br'], 
    negativeTerms: ['vaga', 'emprego'],
    columns: [
      { id: 'portos', title: 'Portos e Terminais', keywords: ['porto', 'terminal'], negativeKeywords: [], datePreset: 'Tudo' },
      { id: 'navios', title: 'Navios e Cabotagem', keywords: ['navio', 'cabotagem'], negativeKeywords: [], datePreset: 'Tudo' }
    ]
  },
  {
    id: 'energia',
    title: 'Energia & Infraestrutura',
    sources: ['canalenergia.com.br', 'epbr.com.br'],
    negativeTerms: ['concurso'],
    columns: [
      { id: 'renovaveis', title: 'Renováveis', keywords: ['solar', 'eólica', 'hidrogênio'], negativeKeywords: [], datePreset: 'Tudo' },
      { id: 'petroleo', title: 'Óleo e Gás', keywords: ['petróleo', 'gás', 'petrobras'], negativeKeywords: [], datePreset: 'Tudo' }
    ]
  }
];

// --- Components ---

const App = () => {
  const [user, setUser] = useState<string | null>(localStorage.getItem('lorinvest_user'));
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('lorinvest_profile');
    return saved ? JSON.parse(saved) : { name: '', companyName: 'Lorinvest', industry: 'Investimentos Estratégicos' };
  });
  const [activeTab, setActiveTab] = useState('overview'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ type: string; colId?: string } | null>(null);
  const [tempText, setTempText] = useState('');
  const [tempPass, setTempPass] = useState('');

  useEffect(() => {
    if (user) {
        const savedCats = localStorage.getItem(`lorinvest_cats_${user}`);
        const savedArts = localStorage.getItem(`lorinvest_arts_${user}`);
        setCategories(savedCats ? JSON.parse(savedCats) : DEFAULT_CATEGORIES);
        setArticles(savedArts ? JSON.parse(savedArts) : []);
        if (!profile.name) setProfile(prev => ({...prev, name: user}));
    }
  }, [user]);

  useEffect(() => {
    if (user && categories.length > 0) localStorage.setItem(`lorinvest_cats_${user}`, JSON.stringify(categories));
    if (user) localStorage.setItem(`lorinvest_arts_${user}`, JSON.stringify(articles));
    localStorage.setItem('lorinvest_profile', JSON.stringify(profile));
  }, [categories, articles, user, profile]);

  const currentCategory = useMemo(() => categories.find(c => c.id === activeTab), [categories, activeTab]);

  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [articles]);

  const handleSync = async () => {
    if (!currentCategory || loading) return;
    
    const allKeywords = Array.from(new Set(currentCategory.columns.flatMap(c => c.keywords)));
    setLoading(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const siteQuery = currentCategory.sources.length > 0 
        ? `(${currentCategory.sources.map(s => `site:${s.trim()}`).join(' OR ')})` 
        : "";
      
      const negativePart = currentCategory.negativeTerms.length > 0
        ? " " + currentCategory.negativeTerms.map(t => `-${t.trim()}`).join(' ')
        : "";

      const keywordsPart = allKeywords.length > 0 
        ? `(${allKeywords.join(' OR ')})` 
        : `"${currentCategory.title}"`;

      const q = `${keywordsPart} ${siteQuery} ${negativePart}`.trim();
      
      const response = await fetch(`/api/news?q=${encodeURIComponent(q)}`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      
      const serpData = await response.json();

      if (!serpData.news_results || serpData.news_results.length === 0) {
        alert(`Nenhum resultado recente para "${currentCategory.title}".`);
        setLoading(false);
        return;
      }

      const rawNewsItems = serpData.news_results.slice(0, 15).map((r: any) => ({
        title: r.title,
        link: r.link,
        source: r.source?.name || "Fonte Externa",
        date: r.date || new Date().toISOString(),
        snippet: r.snippet || ""
      }));

      const processingPrompt = `ANALISTA LORINVEST: Processe e classifique estas notícias reais para a categoria estratégica "${currentCategory.title}".
      IDs de Colunas para classificação: ${currentCategory.columns.map(c => c.id).join(', ')}.
      REGRAS: 
      1. Classifique em uma das colunas se houver correspondência clara baseada no título e snippet.
      2. Se for relevante mas não couber nas colunas existentes, retorne "columnId": null.
      3. Mantenha os links originais.
      
      RETORNE APENAS JSON: {"news": [{"headline": "...", "summary": "...", "source": "...", "url": "...", "date": "ISO_DATE", "columnId": "ID_OU_NULL"}]}`;

      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: processingPrompt + "\n\nDADOS PARA PROCESSAR:\n" + JSON.stringify(rawNewsItems),
        config: { responseMimeType: 'application/json' }
      });

      const data = JSON.parse(geminiResponse.text || '{"news":[]}');
      const newsItems = (data.news || []).filter((n: any) => rawNewsItems.some((r: any) => r.link === n.url));

      const newArts: Article[] = newsItems.map((n: any) => ({
          ...n,
          id: Math.random().toString(36).substr(2, 9),
          categoryId: currentCategory.id,
          date: n.date || new Date().toISOString()
      }));

      setArticles(prev => {
          const urls = new Set(prev.map(a => a.url));
          const toAdd = newArts.filter((a: any) => !urls.has(a.url));
          return [...toAdd, ...prev];
      });

    } catch (e: any) { 
        console.error(e);
        alert(`Erro na sincronização: ${e.message}`);
    } finally { setLoading(false); }
  };

  const toggleFavorite = (id: string) => {
    setArticles(prev => prev.map(art => art.id === id ? { ...art, isFavorite: !art.isFavorite } : art));
  };

  const checkKeywords = (text: string, keywords: string[]) => {
    const t = text.toLowerCase();
    return keywords.filter(kw => t.includes(kw.toLowerCase()));
  };

  const filterByDate = (dateStr: string, preset: DatePreset, customStart?: string, customEnd?: string) => {
    const date = new Date(dateStr).getTime();
    const now = Date.now();
    
    switch (preset) {
        case '24h': return now - date < 24 * 60 * 60 * 1000;
        case '7d': return now - date < 7 * 24 * 60 * 60 * 1000;
        case '1M': return now - date < 30 * 24 * 60 * 60 * 1000;
        case '3M': return now - date < 90 * 24 * 60 * 60 * 1000;
        case 'Custom': {
          const startTime = customStart ? new Date(customStart + "T00:00:00").getTime() : 0;
          const endTime = customEnd ? new Date(customEnd + "T23:59:59").getTime() : Infinity;
          return date >= startTime && date <= endTime;
        }
        case 'Tudo':
        default: return true;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="bg-slate-800 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/20">
              <Shield className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white">Lorinvest Intelligence</h1>
            <p className="text-slate-400 text-sm mt-2">Monitoramento Estratégico de Ativos</p>
          </div>
          <div className="p-8 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Usuário</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="Seu nome de usuário"
                  value={tempText}
                  onChange={e => setTempText(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Senha</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="********"
                  value={tempPass}
                  onChange={e => setTempPass(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter' && tempText && tempPass) { setUser(tempText); localStorage.setItem('lorinvest_user', tempText); }}}
                />
              </div>
            </div>
            <button 
              onClick={() => { if(tempText && tempPass) { setUser(tempText); localStorage.setItem('lorinvest_user', tempText); } }}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
            >
              Acessar Terminal
            </button>
            <p className="text-center text-xs text-slate-400">Acesso restrito a analistas autorizados.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 shrink-0 shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('overview')}>
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-slate-900">{profile.companyName}</span>
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-none">Intelligence</div>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-12 hidden md:block">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl outline-none text-sm transition-all"
              placeholder="Pesquisar inteligência de mercado..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-100 rounded-full">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-slate-700">{profile.name}</span>
          </div>
          <button 
            onClick={() => setModal({type: 'settings'})}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={() => {setUser(null); localStorage.removeItem('lorinvest_user');}}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav className="h-12 bg-white border-b border-slate-200 flex items-center px-6 gap-2 overflow-x-auto no-scrollbar shrink-0">
        <button 
          onClick={() => setActiveTab('overview')}
          className={cn(
            "flex items-center gap-2 px-4 h-full text-sm font-bold transition-all border-b-2",
            activeTab === 'overview' ? "text-blue-600 border-blue-600 bg-blue-50/50" : "text-slate-500 border-transparent hover:text-slate-800"
          )}
        >
          <LayoutDashboard className="w-4 h-4" /> Geral
        </button>
        <button 
          onClick={() => setActiveTab('favorites')}
          className={cn(
            "flex items-center gap-2 px-4 h-full text-sm font-bold transition-all border-b-2",
            activeTab === 'favorites' ? "text-blue-600 border-blue-600 bg-blue-50/50" : "text-slate-500 border-transparent hover:text-slate-800"
          )}
        >
          <Star className={cn("w-4 h-4", activeTab === 'favorites' && "fill-blue-600")} /> Favoritos
        </button>
        <div className="w-px h-6 bg-slate-200 mx-2" />
        {categories.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={cn(
              "flex items-center gap-2 px-4 h-full text-sm font-bold transition-all border-b-2 whitespace-nowrap",
              activeTab === cat.id ? "text-blue-600 border-blue-600 bg-blue-50/50" : "text-slate-500 border-transparent hover:text-slate-800"
            )}
          >
            {cat.title}
          </button>
        ))}
        <button 
          onClick={() => { setModal({ type: 'new-category' }); setTempText(''); }}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-all ml-2"
        >
          <Plus className="w-3.5 h-3.5" /> Categoria
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' ? (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                  <Shield className="w-64 h-64" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                      <Shield className="text-blue-600 w-6 h-6" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900">Hub de Inteligência</h2>
                  </div>
                  <p className="text-slate-500 max-w-2xl text-lg leading-relaxed">
                    Monitoramento avançado para o setor de <span className="text-blue-600 font-bold">{profile.industry}</span>. 
                    Nossa IA processa milhares de fontes para entregar insights táticos em tempo real.
                  </p>
                  
                  <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-all">
                      <Globe className="text-blue-600 w-6 h-6 mb-4" />
                      <div className="text-3xl font-black text-slate-900">{categories.length}</div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Categorias Ativas</div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-green-200 transition-all">
                      <TrendingUp className="text-green-600 w-6 h-6 mb-4" />
                      <div className="text-3xl font-black text-slate-900">{articles.length}</div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Dados Processados</div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-purple-200 transition-all">
                      <Newspaper className="text-purple-600 w-6 h-6 mb-4" />
                      <div className="text-3xl font-black text-slate-900">{articles.filter(a => a.isFavorite).length}</div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Insights Salvos</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map(cat => (
                  <motion.div 
                    whileHover={{ y: -4 }}
                    key={cat.id} 
                    className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setActiveTab(cat.id)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{cat.title}</h3>
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cat.columns.map(col => (
                        <span key={col.id} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                          {col.title}
                        </span>
                      ))}
                      {cat.columns.length === 0 && <span className="text-[10px] font-bold text-slate-400 italic">Nova Categoria</span>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : activeTab === 'favorites' ? (
            <motion.div 
              key="favorites"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            >
              {sortedArticles.filter(a => a.isFavorite).map(art => (
                <ArticleCard key={art.id} art={art} toggleFavorite={toggleFavorite} />
              ))}
              {sortedArticles.filter(a => a.isFavorite).length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-24 text-slate-400">
                  <Star className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-lg font-medium">Nenhum insight favoritado ainda.</p>
                </div>
              )}
            </motion.div>
          ) : currentCategory ? (
            <motion.div 
              key={currentCategory.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-slate-900">{currentCategory.title}</h1>
                  <p className="text-slate-500 text-sm mt-1">Monitoramento tático e classificação por IA.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    onClick={handleSync} 
                    disabled={loading}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95",
                      loading && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    {loading ? 'Sincronizando...' : 'Sincronizar'}
                  </button>
                  <button 
                    onClick={() => { setModal({ type: 'negative-category' }); setTempText(currentCategory.negativeTerms.join(', ')); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    <Filter className="w-4 h-4 text-red-500" /> Exclusões
                  </button>
                  <button 
                    onClick={() => { setModal({type: 'sources'}); setTempText(currentCategory.sources.join(', ')); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    <Globe className="w-4 h-4 text-blue-500" /> Fontes
                  </button>
                  <button 
                    onClick={() => { setModal({ type: 'new-column' }); setTempText(''); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Nova Coluna
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-x-auto pb-6 flex gap-6 no-scrollbar">
                {currentCategory.columns.map(col => {
                  const colArticles = sortedArticles.filter(a => 
                    a.categoryId === currentCategory.id && 
                    (a.columnId === col.id || checkKeywords(a.headline + ' ' + a.summary, col.keywords).length > 0) && 
                    filterByDate(a.date, col.datePreset, col.customStartDate, col.customEndDate) &&
                    (!searchQuery || a.headline.toLowerCase().includes(searchQuery.toLowerCase()))
                  );
                  return (
                    <div key={col.id} className="w-80 shrink-0 flex flex-col gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-slate-300" />
                            <h3 className="font-bold text-slate-800 truncate max-w-[140px]">{col.title}</h3>
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-black rounded-md">{colArticles.length}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setModal({ type: 'rename-column', colId: col.id }); setTempText(col.title); }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { setModal({ type: 'edit-keywords', colId: col.id }); setTempText(col.keywords.join(', ')); }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Tag className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setCategories(prev => prev.map(cat => cat.id === currentCategory.id ? {...cat, columns: cat.columns.filter(c => c.id !== col.id)} : cat))} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select 
                            value={col.datePreset} 
                            onChange={(e) => setCategories(prev => prev.map(cat => cat.id === currentCategory.id ? {...cat, columns: cat.columns.map(c => c.id === col.id ? {...c, datePreset: e.target.value as DatePreset} : c)} : cat))} 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="Tudo">Todo período</option>
                            <option value="24h">Últimas 24h</option>
                            <option value="7d">Últimos 7 dias</option>
                            <option value="1M">Último mês</option>
                            <option value="Custom">Personalizado</option>
                          </select>
                        </div>
                        {col.datePreset === 'Custom' && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <input 
                              type="date" 
                              value={col.customStartDate || ''} 
                              onChange={(e) => setCategories(prev => prev.map(cat => cat.id === currentCategory.id ? {...cat, columns: cat.columns.map(c => c.id === col.id ? {...c, customStartDate: e.target.value} : c)} : cat))}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 outline-none"
                            />
                            <input 
                              type="date" 
                              value={col.customEndDate || ''} 
                              onChange={(e) => setCategories(prev => prev.map(cat => cat.id === currentCategory.id ? {...cat, columns: cat.columns.map(c => c.id === col.id ? {...c, customEndDate: e.target.value} : c)} : cat))}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 outline-none"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 overflow-y-auto no-scrollbar pb-12">
                        {colArticles.map(art => (
                          <ArticleCard key={art.id} art={art} toggleFavorite={toggleFavorite} keywords={col.keywords} />
                        ))}
                        {colArticles.length === 0 && (
                          <div className="py-12 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-2xl">
                            <Newspaper className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-xs font-bold uppercase tracking-widest">Sem dados</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Inbox Column */}
                {sortedArticles.filter(a => a.categoryId === currentCategory.id && !a.columnId && !currentCategory.columns.some(col => checkKeywords(a.headline, col.keywords).length > 0)).length > 0 && (
                  <div className="w-80 shrink-0 flex flex-col gap-4">
                    <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-purple-500" />
                        <h3 className="font-bold text-purple-800">Descobertas</h3>
                        <span className="px-1.5 py-0.5 bg-purple-200 text-purple-700 text-[10px] font-black rounded-md">
                          {sortedArticles.filter(a => a.categoryId === currentCategory.id && !a.columnId).length}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 overflow-y-auto no-scrollbar pb-12">
                      {sortedArticles.filter(a => a.categoryId === currentCategory.id && !a.columnId).map(art => (
                        <ArticleCard key={art.id} art={art} toggleFavorite={toggleFavorite} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModal(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black tracking-tight text-slate-900">
                  {modal.type === 'settings' ? 'Configurações' : modal.type.replace('-', ' ').toUpperCase()}
                </h3>
                <button onClick={() => setModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8">
                {modal.type === 'settings' ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest">Perfil do Analista</h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Nome de Exibição</label>
                          <input 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={profile.name}
                            onChange={e => setProfile({...profile, name: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest">Dados Corporativos</h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Empresa</label>
                          <input 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={profile.companyName}
                            onChange={e => setProfile({...profile, companyName: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Indústria</label>
                          <input 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={profile.industry}
                            onChange={e => setProfile({...profile, industry: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {modal.type.includes('keywords') || modal.type.includes('sources') || modal.type.includes('negative') ? 'Valores (separados por vírgula)' : 'Título'}
                    </label>
                    <textarea 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[120px] text-sm"
                      value={tempText}
                      onChange={e => setTempText(e.target.value)}
                      placeholder={modal.type.includes('keywords') ? "ex: porto, terminal, logística" : "Digite aqui..."}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setModal(null)}
                  className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    const vals = tempText.split(',').map(v => v.trim()).filter(Boolean);
                    if (modal.type === 'new-category') {
                        if (tempText) setCategories([...categories, { id: `cat-${Date.now()}`, title: tempText, sources: [], negativeTerms: [], columns: [] }]);
                    } else if (modal.type === 'new-column' && currentCategory) {
                        if (tempText) setCategories(prev => prev.map(c => c.id === currentCategory.id ? { ...c, columns: [...c.columns, { id: `col-${Date.now()}`, title: tempText, keywords: [], negativeKeywords: [], datePreset: 'Tudo' }] } : c));
                    } else if (modal.type === 'rename-column' && modal.colId) {
                        setCategories(prev => prev.map(c => c.id === currentCategory.id ? { ...c, columns: c.columns.map(col => col.id === modal.colId ? { ...col, title: tempText } : col) } : c));
                    } else if (modal.type === 'edit-keywords' && modal.colId) {
                        setCategories(prev => prev.map(c => c.id === currentCategory.id ? { ...c, columns: c.columns.map(col => col.id === modal.colId ? { ...col, keywords: vals } : col) } : c));
                    } else if (modal.type === 'sources' && currentCategory) {
                        setCategories(prev => prev.map(c => c.id === currentCategory.id ? {...c, sources: vals} : c));
                    } else if (modal.type === 'negative-category' && currentCategory) {
                        setCategories(prev => prev.map(c => c.id === currentCategory.id ? {...c, negativeTerms: vals} : c));
                    }
                    setModal(null);
                  }}
                  className="px-8 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
                >
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ArticleCardProps {
  art: Article;
  toggleFavorite: (id: string) => void;
  keywords?: string[];
}

const ArticleCard: React.FC<ArticleCardProps> = ({ art, toggleFavorite, keywords = [] }) => {
  const matches = useMemo(() => {
    const t = (art.headline + ' ' + art.summary).toLowerCase();
    return keywords.filter(kw => t.includes(kw.toLowerCase()));
  }, [art, keywords]);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
    >
      <button 
        onClick={() => toggleFavorite(art.id)}
        className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-slate-50 text-slate-300 hover:text-amber-500 transition-all"
      >
        <Star className={cn("w-4 h-4", art.isFavorite && "fill-amber-500 text-amber-500")} />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{art.source}</span>
        <span className="w-1 h-1 bg-slate-300 rounded-full" />
        <span className="text-[10px] font-bold text-slate-400">{new Date(art.date).toLocaleDateString('pt-BR')}</span>
      </div>

      <h4 className="text-sm font-bold text-slate-900 leading-snug mb-2 group-hover:text-blue-600 transition-colors">
        {art.headline}
      </h4>
      
      <p className="text-xs text-slate-500 line-clamp-3 mb-4 leading-relaxed">
        {art.summary}
      </p>

      {matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {matches.map(m => (
            <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-[9px] font-black uppercase tracking-wider rounded-md border border-green-100">
              <CheckCircle2 className="w-2.5 h-2.5" /> {m}
            </span>
          ))}
        </div>
      )}

      <button 
        onClick={() => window.open(art.url, '_blank')}
        className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-all"
      >
        Acessar Fonte <ExternalLink className="w-3 h-3" />
      </button>
    </motion.div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
