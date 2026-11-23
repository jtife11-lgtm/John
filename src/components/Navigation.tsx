import React from 'react';
import {
  Activity,
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
  Swords,
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
    unreadCount,
    notifications,
    lang,
  } = useApp();

  const chatUnread = notifications.filter(
    (n) => !n.read && (n.type === 'chat' || n.type === 'friend' || n.type === 'streak')
  ).length;

  const primaryLinks: { id: NavTab; label: string; badge?: number }[] = [
    { id: 'home', label: t(lang, 'home') },
    { id: 'scores', label: t(lang, 'scores') },
    { id: 'community', label: t(lang, 'chat'), badge: chatUnread },
    { id: 'games', label: t(lang, 'games') },
    { id: 'news', label: t(lang, 'news') },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#07090F]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
      {/* Strict 3-Zone Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2.5 text-slate-900 dark:text-white whitespace-nowrap shrink-0 group"
        >
          <img
            src={LOGO_URL}
            alt="STR SCORES"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-lg object-cover border border-[#E11D48]/50 group-hover:border-[#E11D48] transition"
          />
          <span className="font-display text-xl font-extrabold tracking-tight">
            STR <span className="text-[#E11D48]">SCORES</span>
          </span>
        </button>

        {/* Zone 2: 5 Clean Single-Line Nav Links (Desktop/Tablet) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {primaryLinks.map((link) => {
            const active = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`relative py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 inline-flex items-center gap-1.5 ${
                  active
                    ? 'text-[#E11D48] dark:text-white border-[#E11D48] font-bold'
                    : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {link.id === 'community' && <MessageSquare className="w-3.5 h-3.5 text-[#E11D48]" />}
                {link.label}
                {typeof link.badge === 'number' && link.badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#E11D48] text-white text-[10px] font-bold flex items-center justify-center">
                    {link.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Profile / Auth Action */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <button
              onClick={() => setActiveTab('profile')}
              className={`relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition whitespace-nowrap shrink-0 min-h-[38px] ${
                activeTab === 'profile'
                  ? 'bg-[#E11D48] text-white border-[#E11D48]'
                  : 'bg-slate-100 dark:bg-[#0F1219] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:border-[#E11D48]/60'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span className="max-w-[100px] truncate">
                {userProfile?.displayName || user.displayName || t(lang, 'profile')}
              </span>
              {unreadCount > 0 && activeTab !== 'profile' && (
                <span className="w-2 h-2 rounded-full bg-[#E11D48]" />
              )}
            </button>
          ) : (
            <button
              onClick={() => {
                setAuthModalMode('signin');
                setShowAuthModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold hover:bg-[#BE123C] transition whitespace-nowrap shrink-0 shadow-sm shadow-[#E11D48]/25"
            >
              {t(lang, 'signIn')}
            </button>
          )}
        </div>
      </div>

      {/* Workspace Sub-Toolbar for Secondary Modules & Quick Utilities */}
      <div className="border-t border-slate-200/70 dark:border-white/5 bg-slate-50/90 dark:bg-[#0F1219]/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { id: 'simulator' as NavTab, label: t(lang, 'simulator'), icon: Swords },
              { id: 'cards' as NavTab, label: t(lang, 'cards'), icon: Layers },
              { id: 'players' as NavTab, label: t(lang, 'players'), icon: Users },
              { id: 'ai' as NavTab, label: t(lang, 'aiCenter'), icon: Bot },
              { id: 'stats' as NavTab, label: t(lang, 'stats'), icon: BarChart3 },
              { id: 'fantasy' as NavTab, label: t(lang, 'fantasy'), icon: Trophy },
              { id: 'vote' as NavTab, label: t(lang, 'vote'), icon: Vote },
              { id: 'extra' as NavTab, label: t(lang, 'explore'), icon: BookOpen },
              { id: 'profile' as NavTab, label: t(lang, 'profile'), icon: User },
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
                      ? 'bg-[#E11D48] text-white font-semibold shadow-sm shadow-[#E11D48]/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/5'
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
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/5 whitespace-nowrap"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Search</span>
      </button>

      <button
        onClick={() => setActiveTab('profile')}
        title="Notifications"
        className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/5"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E11D48] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      <button
        onClick={toggleTheme}
        title="Toggle Dark / Light Mode"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/5"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <button
        onClick={toggleLang}
        title="Switch English / Arabic"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/5 whitespace-nowrap"
      >
        <Globe className="w-3.5 h-3.5 text-[#E11D48]" />
        {lang === 'en' ? 'AR' : 'EN'}
      </button>
    </div>
  );
}

export function BottomNav() {
  const { activeTab, setActiveTab, lang, notifications } = useApp();

  const chatUnread = notifications.filter(
    (n) => !n.read && (n.type === 'chat' || n.type === 'friend' || n.type === 'streak')
  ).length;

  const tabs: { id: NavTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'home', label: t(lang, 'home'), icon: Home },
    { id: 'scores', label: t(lang, 'scores'), icon: Activity },
    { id: 'community', label: t(lang, 'chat'), icon: MessageSquare, badge: chatUnread },
    { id: 'games', label: t(lang, 'games'), icon: Gamepad2 },
    { id: 'news', label: t(lang, 'news'), icon: Newspaper },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#07090F]/95 backdrop-blur-md border-t border-slate-200 dark:border-white/10 pb-safe"
    >
      <div className="grid grid-cols-5 h-16 items-center">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative min-h-[44px] flex flex-col items-center justify-center gap-1 transition ${
                active
                  ? 'text-[#E11D48] dark:text-white font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${active && item.id === 'community' ? 'text-[#E11D48]' : ''}`} />
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E11D48] text-white text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight leading-none">{item.label}</span>
              {active && <span className="w-4 h-0.5 rounded-full bg-[#E11D48]" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
