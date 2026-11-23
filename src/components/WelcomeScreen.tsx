import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Globe, ShieldCheck, Sparkles, Trophy, Tv, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';

const LOGO_URL = '/src/assets/images/str_scores_logo_1795349596176.jpg';
const HERO_URL = '/src/assets/images/hero_stadium_night_1795349596580.jpg';

export function WelcomeScreen() {
  const { enterAsGuest, setShowAuthModal, setAuthModalMode, lang, toggleLang } = useApp();

  return (
    <div className="min-h-screen bg-[#07090F] text-white relative overflow-hidden flex flex-col justify-between">
      {/* Stadium Night Atmospheric Backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={HERO_URL}
          alt="Floodlit football stadium pitch at night"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07090F]/80 via-[#07090F]/85 to-[#07090F]" />
      </div>

      {/* Top Strip */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={LOGO_URL}
            alt="STR SCORES emblem"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-cover border border-white/15"
          />
          <span className="font-display text-2xl font-extrabold tracking-wide">STR SCORES</span>
        </div>
        <button
          onClick={toggleLang}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold transition whitespace-nowrap"
        >
          <Globe className="w-4 h-4 text-[#E11D48]" />
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </header>

      {/* Main Welcome Hero */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-6 py-8 grid lg:grid-cols-12 gap-10 items-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="lg:col-span-7 space-y-6"
        >
          <p className="text-xs font-semibold tracking-widest text-[#E11D48]">
            {lang === 'ar'
              ? 'كرة القدم المباشرة · الذكاء الاصطناعي · الألعاب · المجتمع'
              : 'LIVE FOOTBALL · AI MATCH CENTER · GAMES · FANTASY · COMMUNITY'}
          </p>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-[1.03] text-balance">
            {lang === 'ar'
              ? 'عالم كرة القدم والألعاب المتكامل في مكان واحد'
              : 'Every Live Match, Tactical Insight & Supporter Arena in One Universe'}
          </h1>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl leading-relaxed">
            {lang === 'ar'
              ? 'تابع النتائج المباشرة لأكبر الدوريات والدوري اللبناني، استخدم مساعد STR الذكي، العب التحديات اليومية، ابنِ فريق الفانتازي وتواصل مع أصدقائك.'
              : 'Follow real-time scores across the Premier League, Champions League, La Liga, Saudi Pro League, and Lebanese Premier League. Play football mini-games, vote in STR VOTE, and chat with friends.'}
          </p>

          {/* Primary Actions */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-2">
            <button
              onClick={() => enterAsGuest(true)}
              className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-[#E11D48] text-white font-bold text-sm hover:brightness-105 active:scale-[0.99] transition shadow-lg shadow-[#E11D48]/20 whitespace-nowrap"
            >
              {t(lang, 'continueGuest')}
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setAuthModalMode('signin');
                setShowAuthModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm transition whitespace-nowrap"
            >
              {t(lang, 'signIn')}
            </button>

            <button
              onClick={() => {
                setAuthModalMode('signup');
                setShowAuthModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0F1219] hover:bg-[#111D35] border border-slate-700 text-slate-100 font-semibold text-sm transition whitespace-nowrap"
            >
              {t(lang, 'createAccount')}
            </button>
          </div>

          {/* Transparent Guest vs Account Explanation */}
          <div className="rounded-2xl bg-[#0F1219]/90 border border-slate-800 p-4 text-xs sm:text-sm text-slate-300 space-y-1.5 max-w-2xl">
            <p className="font-semibold text-white">
              {lang === 'ar'
                ? 'ماذا يمكنك استكشافه بدون حساب؟'
                : 'Explore freely right away — no sign-up wall'}
            </p>
            <p className="text-slate-400 leading-relaxed">
              {lang === 'ar'
                ? 'يمكنك متابعة النتائج المباشرة، الأخبار، الإحصائيات، الألعاب، المساعد الذكي، واستطلاعات التصويت كضيف. يتطلب إنشاء حساب فقط للدردشة الخاصة، طلبات الصداقة، المكالمات، وحفظ تفضيلاتك السحابية.'
                : 'Guests get instant access to Live Scores, Football & Gaming News, Mini-Games, Statistics Center, STR AI Match Center, and public STR VOTE polls. Create a free account later to unlock Private Chats, Friend Requests, Voice/Video Calls, and cloud-synced Fantasy squads.'}
            </p>
          </div>
        </motion.div>

        {/* Animated Crest & Feature Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-5 bg-[#0F1219]/95 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl"
        >
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, 3, -3, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="w-16 h-16 rounded-2xl overflow-hidden border border-[#E11D48]/40 shrink-0 shadow-lg shadow-[#E11D48]/10"
            >
              <img
                src={LOGO_URL}
                alt="STR SCORES Crest"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </motion.div>
            <div>
              <h2 className="font-display text-2xl font-bold">STR SCORES Matchday</h2>
              <p className="text-xs text-slate-400">
                Real match feeds · Gemini AI Analyst · Real-time Community
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Tv, title: 'Live Scoreboard', desc: '10+ major leagues & cup feeds' },
              { icon: Sparkles, title: 'STR AI Center', desc: 'Tactical summaries & Q&A' },
              { icon: Trophy, title: 'Games & Fantasy', desc: 'Penalty shootout, trivia & XI' },
              { icon: Users, title: 'Supporter Chat', desc: 'Rooms, voice notes & calls' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl bg-[#07090F]/80 border border-slate-800/80 p-3.5 space-y-1.5"
                >
                  <Icon className="w-5 h-5 text-[#E11D48]" />
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 text-xs text-slate-400 pt-1">
            <ShieldCheck className="w-4 h-4 text-[#E11D48] shrink-0" />
            <span>Verified Firebase Auth & Firestore Security · No Gambling or Betting</span>
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 max-w-6xl w-full mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 border-t border-white/5">
        <span>STR SCORES · Football Scores, Gaming & Community</span>
        <span>Built for Mobile, Tablet, Desktop & Android Capacitor</span>
      </footer>
    </div>
  );
}
