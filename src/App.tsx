import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WelcomeScreen } from './components/WelcomeScreen';
import { AuthModal } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { TopNavbar, BottomNav, QuickCommunityFab } from './components/Navigation';
import { HomeFeed } from './components/HomeFeed';
import { ScoresCenter } from './components/ScoresCenter';
import { MatchDetailModal } from './components/MatchDetailModal';
import { AiMatchCenter } from './components/AiMatchCenter';
import { NewsCenter } from './components/NewsCenter';
import { GamesHub } from './components/GamesHub';
import { CommunityHub } from './components/CommunityHub';
import { StatisticsCenter } from './components/StatisticsCenter';
import { FantasyPredictions } from './components/FantasyPredictions';
import { StrVoteCenter } from './components/StrVoteCenter';
import { ProfileScreen, AdminDashboard } from './components/ProfileAndAdmin';
import { ExtraFeatures } from './components/ExtraFeatures';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { PlayerCardsHub } from './components/PlayerCardsHub';
import { PlayerProfiles } from './components/PlayerProfiles';

function StrScoresShell() {
  const { authReady, hasEnteredApp, user, activeTab } = useApp();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#060B16] text-white flex flex-col items-center justify-center gap-4">
        <img
          src="/src/assets/images/str_scores_logo_1795349596176.jpg"
          alt="STR SCORES"
          referrerPolicy="no-referrer"
          className="w-16 h-16 rounded-2xl object-cover border border-[#00E676]/40"
        />
        <p className="font-display text-2xl font-bold tracking-wide">STR SCORES</p>
      </div>
    );
  }

  const showWelcome = !hasEnteredApp && !user;

  return (
    <>
      {showWelcome ? (
        <WelcomeScreen />
      ) : (
        <div className="min-h-screen bg-slate-50 dark:bg-[#060B16] text-slate-900 dark:text-slate-100 pb-24 md:pb-12">
          <TopNavbar />

          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {activeTab === 'home' && <HomeFeed />}
            {activeTab === 'scores' && <ScoresCenter />}
            {activeTab === 'games' && <GamesHub />}
            {activeTab === 'cards' && <PlayerCardsHub />}
            {activeTab === 'players' && <PlayerProfiles />}
            {activeTab === 'news' && <NewsCenter />}
            {activeTab === 'community' && <CommunityHub />}
            {activeTab === 'ai' && <AiMatchCenter />}
            {activeTab === 'stats' && <StatisticsCenter />}
            {activeTab === 'fantasy' && <FantasyPredictions />}
            {activeTab === 'vote' && <StrVoteCenter />}
            {activeTab === 'extra' && <ExtraFeatures />}
            {activeTab === 'profile' && <ProfileScreen />}
            {activeTab === 'admin' && <AdminDashboard />}
          </main>

          <QuickCommunityFab />
          <BottomNav />
        </div>
      )}

      <AuthModal />
      <OnboardingModal />
      <MatchDetailModal />
      <GlobalSearchModal />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <StrScoresShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
