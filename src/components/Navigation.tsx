import React from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Gamepad2,
  Globe,
  Home,
  Layers,
  MessageSquare,
  Moon,
  Newspaper,
  Search,
  Shield,
  Sun,
  Trophy,
  User,
  Users,
  Vote,
} from 'lucide-react';
import { useApp, type NavTab } from '../context/AppContext';
import { t } from '../lib/i18n';

const LOGO_URL = '/src/assets/images/str_scores_logo_1795349596176.jpg';

export function TopNavbar() {
  const {
    user,
    userProfile,
    isAdmin,
    activeTab,
    setActiveTab,
    setShowAuthModal,
    setAuthModalMode,
    lang,
  } = useApp();

  const primaryLinks: { id: NavTab; label: string }[] = [
    { id: 'home', label: t(lang, 'home') },
    { id: 'scores', label: t(lang, 'scores') },
    { id: 'games', label: t(lang, 'games') },
    { id: 'news', label: t(lang, 'news') },
    { id: 'community', label: t(lang, 'community') },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#060B16]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/90">
      {/* Strict 3-Zone Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2.5 text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          <img
            src={LOGO_URL}
            alt="STR SCORES"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
          />
          <span className="font-display text-xl font-extrabold tracking-tight">STR SCORES</span>
        </button>

        {/* Zone 2: 5 Clean Single-Line Nav Links (Desktop/Tablet) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {primaryLinks.map((link) => {
            const active = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  active
                    ? 'text-[#00A844] dark:text-[#00E676] border-[#00E676] font-semibold'
                    : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          {user ? (
            <button
              onClick={() => setActiveTab('profile')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white hover:border-[#00E676] transition whitespace-nowrap shrink-0"
            >
              <User className="w-4 h-4 text-[#00E676]" />
              <span className="max-w-[110px] truncate">
                {userProfile?.displayName || user.displayName || 'Profile'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                setAuthModalMode('signin');
                setShowAuthModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold hover:brightness-105 transition whitespace-nowrap shrink-0"
            >
              {t(lang, 'signIn')}
            </button>
          )}
        </div>
      </div>

      {/* Workspace Sub-Toolbar for Secondary Modules & Quick Utilities */}
      <div className="border-t border-slate-200/70 dark:border-slate-800/60 bg-slate-50/80 dark:bg-[#0B1324]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { id: 'cards' as NavTab, label: t(lang, 'cards'), icon: Layers },
              { id: 'players' as NavTab, label: t(lang, 'players'), icon: Users },
              { id: 'ai' as NavTab, label: t(lang, 'aiCenter'), icon: Bot },
              { id: 'stats' as NavTab, label: t(lang, 'stats'), icon: BarChart3 },
              { id: 'fantasy' as NavTab, label: t(lang, 'fantasy'), icon: Trophy },
              { id: 'vote' as NavTab, label: t(lang, 'vote'), icon: Vote },
              { id: 'extra' as NavTab, label: t(lang, 'explore'), icon: BookOpen },
              ...(isAdmin ? [{ id: 'admin' as NavTab, label: t(lang, 'adminPanel'), icon: Shield }] : []),
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition ${
                    active
                      ? 'bg-[#00E676] text-[#060B16] font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <UtilityControls />
        </div>
      </div>
    </header>
  );
}

function UtilityControls() {
  const { setShowSearchModal, theme, toggleTheme, lang, toggleLang, unreadCount, setActiveTab } =
    useApp();

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        onClick={() => setShowSearchModal(true)}
        title="Search STR SCORES"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 whitespace-nowrap"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Search</span>
      </button>

      <button
        onClick={() => setActiveTab('profile')}
        title="Notifications"
        className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#00E676] text-[#060B16] text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      <button
        onClick={toggleTheme}
        title="Toggle Dark / Light Mode"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <button
        onClick={toggleLang}
        title="Switch English / Arabic"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 whitespace-nowrap"
      >
        <Globe className="w-3.5 h-3.5 text-[#00E676]" />
        {lang === 'en' ? 'AR' : 'EN'}
      </button>
    </div>
  );
}

export function BottomNav() {
  const { activeTab, setActiveTab, lang } = useApp();

  const tabs: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: 'home', label: t(lang, 'home'), icon: Home },
    { id: 'scores', label: t(lang, 'scores'), icon: Activity },
    { id: 'games', label: t(lang, 'games'), icon: Gamepad2 },
    { id: 'news', label: t(lang, 'news'), icon: Newspaper },
    { id: 'profile', label: t(lang, 'profile'), icon: User },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#060B16]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe"
    >
      <div className="grid grid-cols-5 h-16 items-center">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition ${
                active
                  ? 'text-[#00A844] dark:text-[#00E676] font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function QuickCommunityFab() {
  const { activeTab, setActiveTab } = useApp();
  if (activeTab === 'community') return null;
  return (
    <button
      onClick={() => setActiveTab('community')}
      aria-label="Open STR Chat & Community"
      className="md:hidden fixed bottom-20 right-4 z-30 w-12 h-12 rounded-2xl bg-[#00E676] text-[#060B16] shadow-lg shadow-[#00E676]/25 flex items-center justify-center hover:brightness-105 transition"
    >
      <MessageSquare className="w-5 h-5" />
    </button>
  );
}

// Re-export unused icon guard
void Award;
