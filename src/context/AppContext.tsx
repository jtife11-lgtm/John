import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut as fbSignOut,
  sendEmailVerification,
  reload,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Lang } from '../lib/i18n';

export type NavTab =
  | 'home'
  | 'scores'
  | 'simulator'
  | 'games'
  | 'cards'
  | 'players'
  | 'news'
  | 'profile'
  | 'community'
  | 'stats'
  | 'fantasy'
  | 'vote'
  | 'ai'
  | 'extra'
  | 'admin';

export interface OnboardingPrefs {
  favoriteTeams: string[];
  favoriteNationalTeams: string[];
  favoriteLeagues: string[];
  favoritePlayers: string[];
  favoriteCountry: string;
  favoriteCity: string;
  favoritePosition: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  favoriteTeams: string[];
  favoriteNationalTeams: string[];
  favoriteLeagues: string[];
  favoritePlayers: string[];
  favoriteCountry: string;
  favoriteCity?: string;
  favoritePosition?: string;
  points: number;
  achievements: string[];
  online?: boolean;
}

export interface UserPrivate {
  uid: string;
  email: string;
  language: Lang;
  theme: 'dark' | 'light';
  notifGoals: boolean;
  notifKickoff: boolean;
  notifFinal: boolean;
  notifRedCards: boolean;
  notifNews: boolean;
  notifFriends: boolean;
  notifGroups: boolean;
  notifQuiz: boolean;
  blockedUids: string[];
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt?: any;
}

interface ToastItem {
  id: string;
  message: string;
  tone: 'success' | 'info' | 'error';
}

interface AppContextValue {
  user: User | null;
  authReady: boolean;
  isGuest: boolean;
  hasEnteredApp: boolean;
  showOnboarding: boolean;
  setShowOnboarding: (v: boolean) => void;
  enterAsGuest: (withOnboarding?: boolean) => void;
  userProfile: UserProfile | null;
  userPrivate: UserPrivate | null;
  isAdmin: boolean;
  guestPrefs: OnboardingPrefs;
  savePreferences: (prefs: OnboardingPrefs) => Promise<void>;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  lang: Lang;
  toggleLang: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  markNotificationRead: (id: string) => Promise<void>;
  showAuthModal: boolean;
  setShowAuthModal: (v: boolean) => void;
  authModalMode: 'signin' | 'signup';
  setAuthModalMode: (m: 'signin' | 'signup') => void;
  showSearchModal: boolean;
  setShowSearchModal: (v: boolean) => void;
  selectedMatchForDetail: { leagueId: string; eventId: string } | null;
  setSelectedMatchForDetail: (m: { leagueId: string; eventId: string } | null) => void;
  selectedPlayerKey: string | null;
  setSelectedPlayerKey: (k: string | null) => void;
  pendingChallengeId: string | null;
  setPendingChallengeId: (id: string | null) => void;
  aiInitialQuestion: string | null;
  setAiInitialQuestion: (q: string | null) => void;
  addPoints: (delta: number, achievement?: string) => Promise<void>;
  pushToast: (message: string, tone?: 'success' | 'info' | 'error') => void;
  signOut: () => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshAuthUser: () => Promise<void>;
  wsRef: React.MutableRefObject<WebSocket | null>;
}

const DEFAULT_PREFS: OnboardingPrefs = {
  favoriteTeams: ['Real Madrid', 'Liverpool', 'Al Ansar FC'],
  favoriteNationalTeams: ['Lebanon', 'Argentina'],
  favoriteLeagues: ['eng.1', 'esp.1', 'uefa.champions', 'lbn.1'],
  favoritePlayers: ['Mohamed Salah', 'Kylian Mbappé', 'Hassan Maatouk'],
  favoriteCountry: 'Lebanon',
  favoriteCity: 'Beirut',
  favoritePosition: 'CAM',
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isGuest, setIsGuest] = useState<boolean>(() => localStorage.getItem('str_guest') === '1');
  const [hasEnteredApp, setHasEnteredApp] = useState<boolean>(
    () => localStorage.getItem('str_entered') === '1'
  );
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivate | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [guestPrefs, setGuestPrefs] = useState<OnboardingPrefs>(() => {
    try {
      const saved = localStorage.getItem('str_guest_prefs');
      return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('str_theme') as 'dark' | 'light') || 'dark'
  );
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem('str_lang') as Lang) || 'en'
  );

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedMatchForDetail, setSelectedMatchForDetail] = useState<{
    leagueId: string;
    eventId: string;
  } | null>(null);
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(null);
  const [aiInitialQuestion, setAiInitialQuestion] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  const pushToast = (message: string, tone: 'success' | 'info' | 'error' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3800);
  };

  // Sync theme to documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('str_theme', theme);
  }, [theme]);

  // Sync language & RTL/LTR
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('str_lang', lang);
  }, [lang]);

  // Firebase Auth listener + profile provisioning
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      setAuthReady(true);
      if (fbUser) {
        setIsGuest(false);
        setHasEnteredApp(true);
        localStorage.setItem('str_entered', '1');
        localStorage.removeItem('str_guest');

        // Ensure user public & private doc exist
        try {
          const pubRef = doc(db, 'users', fbUser.uid);
          const pubSnap = await getDoc(pubRef);
          if (!pubSnap.exists()) {
            const cleanBase = (fbUser.displayName || fbUser.email?.split('@')[0] || 'fan')
              .replace(/[^a-zA-Z0-9_]/g, '')
              .slice(0, 18) || 'supporter';
            const uniqueUsername = `${cleanBase}_${fbUser.uid.slice(0, 5)}`;
            await setDoc(pubRef, {
              uid: fbUser.uid,
              username: uniqueUsername,
              displayName: (fbUser.displayName || cleanBase).slice(0, 64),
              avatarUrl: fbUser.photoURL || '',
              bio: 'STR SCORES Supporter',
              favoriteTeams: guestPrefs.favoriteTeams,
              favoriteNationalTeams: guestPrefs.favoriteNationalTeams,
              favoriteLeagues: guestPrefs.favoriteLeagues,
              favoritePlayers: guestPrefs.favoritePlayers,
              favoriteCountry: guestPrefs.favoriteCountry,
              favoriteCity: guestPrefs.favoriteCity,
              favoritePosition: guestPrefs.favoritePosition,
              points: 100,
              achievements: ['First Kickoff'],
              online: true,
              lastSeen: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(pubRef, {
              online: true,
              lastSeen: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }

          const privRef = doc(db, 'users', fbUser.uid, 'private', 'info');
          const privSnap = await getDoc(privRef);
          if (!privSnap.exists()) {
            await setDoc(privRef, {
              uid: fbUser.uid,
              email: fbUser.email || 'user@strscores.app',
              language: lang,
              theme,
              notifGoals: true,
              notifKickoff: true,
              notifFinal: true,
              notifRedCards: true,
              notifNews: true,
              notifFriends: true,
              notifGroups: true,
              notifQuiz: true,
              blockedUids: [],
              updatedAt: serverTimestamp(),
            });
          }

          // Check admin status
          const isPrimaryAdmin =
            fbUser.email === 'johnnwaccbmw@gmail.com' && fbUser.emailVerified;
          if (isPrimaryAdmin) {
            setIsAdmin(true);
          } else {
            const adminSnap = await getDoc(doc(db, 'admins', fbUser.uid)).catch(() => null);
            setIsAdmin(Boolean(adminSnap?.exists()));
          }
        } catch (err) {
          console.error('Profile initialization check:', err);
        }
      } else {
        setUserProfile(null);
        setUserPrivate(null);
        setIsAdmin(false);
        setNotifications([]);
      }
    });
    return () => unsub();
  }, []);

  // Firestore real-time listeners when authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    const unsubPub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    );

    const unsubPriv = onSnapshot(
      doc(db, 'users', user.uid, 'private', 'info'),
      (snap) => {
        if (snap.exists()) {
          setUserPrivate(snap.data() as UserPrivate);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/private/info`);
      }
    );

    const notifQ = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    const unsubNotifs = onSnapshot(
      notifQ,
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AppNotification, 'id'>),
          }))
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    );

    return () => {
      unsubPub();
      unsubPriv();
      unsubNotifs();
    };
  }, [authReady, user]);

  // WebSocket real-time connection for typing & WebRTC call signaling
  useEffect(() => {
    if (!user) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        socket?.send(
          JSON.stringify({
            type: 'auth',
            uid: user.uid,
            displayName: userProfile?.displayName || user.displayName || 'Supporter',
          })
        );
      };

      socket.onmessage = (ev) => {
        try {
          const frame = JSON.parse(ev.data);
          if (frame.type === 'chat_message' && frame.fromUid !== user.uid) {
            pushToast(`💬 ${frame.fromName || 'Supporter'}: ${frame.preview || 'New message'}`, 'info');
          }
        } catch {
          // ignore malformed frame
        }
      };

      socket.onclose = () => {
        if (!closed) {
          setTimeout(connect, 4000);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      socket?.close();
    };
  }, [user?.uid, userProfile?.displayName]);

  const enterAsGuest = (withOnboarding = false) => {
    setIsGuest(true);
    setHasEnteredApp(true);
    localStorage.setItem('str_guest', '1');
    localStorage.setItem('str_entered', '1');
    if (withOnboarding) {
      setShowOnboarding(true);
    }
  };

  const savePreferences = async (prefs: OnboardingPrefs) => {
    setGuestPrefs(prefs);
    localStorage.setItem('str_guest_prefs', JSON.stringify(prefs));
    if (user) {
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          favoriteTeams: prefs.favoriteTeams.slice(0, 20),
          favoriteNationalTeams: prefs.favoriteNationalTeams.slice(0, 10),
          favoriteLeagues: prefs.favoriteLeagues.slice(0, 15),
          favoritePlayers: prefs.favoritePlayers.slice(0, 20),
          favoriteCountry: prefs.favoriteCountry.slice(0, 64),
          favoriteCity: prefs.favoriteCity.slice(0, 64),
          favoritePosition: prefs.favoritePosition.slice(0, 32),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
    pushToast(lang === 'ar' ? 'تم حفظ تفضيلاتك الكروية' : 'Football preferences saved', 'success');
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user) {
      updateDoc(doc(db, 'users', user.uid, 'private', 'info'), {
        theme: next,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  const toggleLang = () => {
    const next: Lang = lang === 'en' ? 'ar' : 'en';
    setLang(next);
    if (user) {
      updateDoc(doc(db, 'users', user.uid, 'private', 'info'), {
        language: next,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  const markNotificationRead = async (id: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const addPoints = async (delta: number, achievement?: string) => {
    if (!user || !userProfile) return;
    const nextPoints = Math.max(0, (userProfile.points || 0) + delta);
    const nextAchievements =
      achievement && !userProfile.achievements?.includes(achievement)
        ? [...(userProfile.achievements || []), achievement].slice(0, 30)
        : userProfile.achievements || [];
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        points: nextPoints,
        achievements: nextAchievements,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const signOut = async () => {
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), {
        online: false,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    await fbSignOut(auth);
    setIsGuest(false);
    localStorage.removeItem('str_guest');
    pushToast(lang === 'ar' ? 'تم تسجيل الخروج' : 'Signed out cleanly', 'info');
  };

  const resendVerification = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      pushToast('Verification link sent to your email.', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'Could not send verification email right now.', 'error');
    }
  };

  const refreshAuthUser = async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    setUser({ ...auth.currentUser });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        user,
        authReady,
        isGuest,
        hasEnteredApp,
        showOnboarding,
        setShowOnboarding,
        enterAsGuest,
        userProfile,
        userPrivate,
        isAdmin,
        guestPrefs,
        savePreferences,
        activeTab,
        setActiveTab,
        theme,
        toggleTheme,
        lang,
        toggleLang,
        notifications,
        unreadCount,
        markNotificationRead,
        showAuthModal,
        setShowAuthModal,
        authModalMode,
        setAuthModalMode,
        showSearchModal,
        setShowSearchModal,
        selectedMatchForDetail,
        setSelectedMatchForDetail,
        selectedPlayerKey,
        setSelectedPlayerKey,
        pendingChallengeId,
        setPendingChallengeId,
        aiInitialQuestion,
        setAiInitialQuestion,
        addPoints,
        pushToast,
        signOut,
        resendVerification,
        refreshAuthUser,
        wsRef,
      }}
    >
      {children}

      {/* Floating Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto px-4 py-3 rounded-xl text-sm font-medium shadow-2xl border backdrop-blur-md transition-all animate-fadeIn ${
                toast.tone === 'success'
                  ? 'bg-[#0F1219]/95 text-white border-[#10B981]/50'
                  : toast.tone === 'error'
                  ? 'bg-rose-950/95 text-rose-100 border-rose-500/60'
                  : 'bg-[#0F1219]/95 text-white border-[#E11D48]/50'
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
