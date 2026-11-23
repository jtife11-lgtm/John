import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const cfg = (window.STR_CONFIG && window.STR_CONFIG.FIREBASE_CONFIG) || null;
const canUseFirebase = Boolean(cfg && cfg.apiKey && (location.protocol === 'http:' || location.protocol === 'https:'));

let app = null;
let auth = null;
let db = null;

const state = {
  user: null,
  profile: null,
  polls: [],
  chats: [],
  messages: [],
  activeChatId: 'channel_global',
  friends: [],
  requests: [],
  streaks: [],
  savedArticles: [],
  predictions: [],
  fantasyTeam: null,
  unsubs: []
};

function notifyUpdate(type) {
  window.dispatchEvent(new CustomEvent('str:fb-update', { detail: { type } }));
}

function clearUnsubs() {
  while (state.unsubs.length) {
    const fn = state.unsubs.pop();
    try { fn(); } catch (e) {}
  }
}

async function ensureUserDoc(user) {
  if (!db || !user) return null;
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { online: true, lastSeen: serverTimestamp(), updatedAt: serverTimestamp() }).catch(() => {});
    return snap.data();
  }
  const cleanUser = (user.email ? user.email.split('@')[0] : 'supporter').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'supporter';
  const payload = {
    uid: user.uid,
    username: cleanUser + '_' + user.uid.slice(0, 4),
    displayName: user.displayName || cleanUser || 'STR Supporter',
    avatarUrl: user.photoURL || '',
    bio: 'Football supporter on STR SCORES.',
    favoriteTeams: JSON.parse(localStorage.getItem('str_standalone_fav_clubs') || '["Real Madrid","Liverpool","Al Ansar FC"]'),
    favoriteLeagues: ['eng.1', 'esp.1', 'uefa.champions'],
    points: Number(localStorage.getItem('str_standalone_xp') || 0),
    online: true,
    lastSeen: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, payload);
  await setDoc(doc(db, 'users', user.uid, 'private', 'info'), {
    uid: user.uid,
    email: user.email || (user.uid + '@strscores.local'),
    language: localStorage.getItem('str_standalone_lang') || 'en',
    theme: localStorage.getItem('str_standalone_theme') || 'dark',
    notifGoals: true,
    updatedAt: serverTimestamp()
  }).catch(() => {});
  return payload;
}

async function ensureDefaultChannel() {
  if (!db || !state.user) return;
  const chRef = doc(db, 'chats', 'channel_global');
  const snap = await getDoc(chRef).catch(() => null);
  if (snap && !snap.exists()) {
    await setDoc(chRef, {
      type: 'channel',
      name: 'STR Matchday Lounge',
      clubTag: 'Global',
      createdBy: state.user.uid,
      participantIds: [state.user.uid],
      lastMessage: 'Welcome to STR SCORES Real-Time Chat!',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).catch(() => {});
  }
}

function attachListeners() {
  clearUnsubs();
  if (!db) return;

  // Public Polls listener
  state.unsubs.push(
    onSnapshot(query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(20)), (snap) => {
      state.polls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notifyUpdate('polls');
    }, () => {})
  );

  if (!state.user) return;
  const uid = state.user.uid;

  state.unsubs.push(
    onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        state.profile = snap.data();
        notifyUpdate('profile');
      }
    }, () => {})
  );

  state.unsubs.push(
    onSnapshot(query(collection(db, 'savedArticles'), where('userId', '==', uid), limit(30)), (snap) => {
      state.savedArticles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notifyUpdate('savedArticles');
    }, () => {})
  );

  state.unsubs.push(
    onSnapshot(query(collection(db, 'predictions'), where('userId', '==', uid), limit(30)), (snap) => {
      state.predictions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notifyUpdate('predictions');
    }, () => {})
  );

  state.unsubs.push(
    onSnapshot(doc(db, 'fantasyTeams', uid), (snap) => {
      state.fantasyTeam = snap.exists() ? snap.data() : null;
      notifyUpdate('fantasy');
    }, () => {})
  );

  state.unsubs.push(
    onSnapshot(query(collection(db, 'friendRequests'), where('toUid', '==', uid), where('status', '==', 'pending')), (snap) => {
      state.requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notifyUpdate('requests');
    }, () => {})
  );

  state.unsubs.push(
    onSnapshot(query(collection(db, 'streaks'), where('participantIds', 'array-contains', uid)), (snap) => {
      state.streaks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notifyUpdate('streaks');
    }, () => {})
  );

  // Public channels + user direct chats
  state.unsubs.push(
    onSnapshot(query(collection(db, 'chats'), where('type', '==', 'channel'), limit(20)), (snap) => {
      const channels = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const directs = state.chats.filter((c) => c.type !== 'channel');
      state.chats = channels.concat(directs);
      notifyUpdate('chats');
    }, () => {})
  );

  state.unsubs.push(
    onSnapshot(query(collection(db, 'chats'), where('participantIds', 'array-contains', uid), limit(30)), (snap) => {
      const myRooms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const byId = {};
      state.chats.forEach((c) => { byId[c.id] = c; });
      myRooms.forEach((c) => { byId[c.id] = c; });
      state.chats = Object.values(byId);
      notifyUpdate('chats');
    }, () => {})
  );

  subscribeChatMessages(state.activeChatId);
}

let msgUnsub = null;
function subscribeChatMessages(chatId) {
  state.activeChatId = chatId;
  if (msgUnsub) {
    try { msgUnsub(); } catch (e) {}
    msgUnsub = null;
  }
  if (!db || !state.user || !chatId) {
    state.messages = [];
    notifyUpdate('messages');
    return;
  }
  msgUnsub = onSnapshot(
    query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(40)),
    (snap) => {
      state.messages = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
      notifyUpdate('messages');
    },
    () => {
      state.messages = [];
      notifyUpdate('messages');
    }
  );
}

if (canUseFirebase) {
  try {
    app = initializeApp(cfg);
    auth = getAuth(app);
    db = cfg.firestoreDatabaseId ? getFirestore(app, cfg.firestoreDatabaseId) : getFirestore(app);
    onAuthStateChanged(auth, async (user) => {
      state.user = user || null;
      if (user) {
        await ensureUserDoc(user).catch(() => {});
        await ensureDefaultChannel().catch(() => {});
      } else {
        state.profile = null;
      }
      attachListeners();
      notifyUpdate('auth');
    });
  } catch (e) {
    console.warn('Firebase initialization skipped:', e);
  }
}

window.STR_FB = {
  isReady: () => Boolean(db && auth),
  getState: () => state,
  subscribeChatMessages,

  async signInEmail(email, password) {
    if (!auth) throw new Error('Firebase Auth requires HTTP/HTTPS hosting.');
    return signInWithEmailAndPassword(auth, email, password);
  },
  async signUpEmail(email, password, displayName) {
    if (!auth) throw new Error('Firebase Auth requires HTTP/HTTPS hosting.');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    await ensureUserDoc(cred.user);
    return cred;
  },
  async signInGoogle() {
    if (!auth) throw new Error('Firebase Auth requires HTTP/HTTPS hosting.');
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  },
  async signOut() {
    if (auth) await fbSignOut(auth);
  },
  async updateProfile(displayName, bio, favTeams) {
    if (!db || !state.user) return;
    await updateDoc(doc(db, 'users', state.user.uid), {
      displayName: (displayName || 'Supporter').slice(0, 64),
      bio: (bio || '').slice(0, 280),
      favoriteTeams: Array.isArray(favTeams) ? favTeams.slice(0, 20) : [],
      updatedAt: serverTimestamp()
    });
  },
  async addUserPoints(delta) {
    if (!db || !state.user || !state.profile) return;
    const nextPts = Math.min(10000000, Math.max(0, Number(state.profile.points || 0) + Number(delta || 0)));
    await updateDoc(doc(db, 'users', state.user.uid), { points: nextPts, updatedAt: serverTimestamp() }).catch(() => {});
  },
  async sendMessage(chatId, text) {
    if (!db || !state.user) throw new Error('Sign in to send real-time messages.');
    const clean = String(text || '').trim().slice(0, 1500);
    if (!clean) return;
    await ensureDefaultChannel();
    const senderName = (state.profile && state.profile.displayName) || state.user.displayName || 'Supporter';
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      senderId: state.user.uid,
      senderName,
      text: clean,
      mediaType: 'text',
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'chats', chatId), { lastMessage: clean.slice(0, 200), updatedAt: serverTimestamp() }).catch(() => {});
  },
  async searchUsers(term) {
    if (!db || !state.user) return [];
    const snap = await getDocs(query(collection(db, 'users'), limit(40)));
    const q = String(term || '').trim().toLowerCase();
    return snap.docs
      .map((d) => d.data())
      .filter((u) => u.uid !== state.user.uid && (!q || (u.displayName || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q)));
  },
  async sendFriendRequest(targetUser) {
    if (!db || !state.user) throw new Error('Sign in required.');
    const myName = (state.profile && state.profile.displayName) || state.user.displayName || 'Supporter';
    const reqId = state.user.uid + '_' + targetUser.uid;
    await setDoc(doc(db, 'friendRequests', reqId), {
      fromUid: state.user.uid,
      toUid: targetUser.uid,
      fromName: myName,
      toName: targetUser.displayName || targetUser.username || 'Supporter',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },
  async respondFriendRequest(reqId, status, fromUid, fromName) {
    if (!db || !state.user) return;
    await updateDoc(doc(db, 'friendRequests', reqId), { status, updatedAt: serverTimestamp() });
    if (status === 'accepted' && fromUid) {
      const pair = [state.user.uid, fromUid].sort();
      const dmId = 'dm_' + pair[0].slice(0, 12) + '_' + pair[1].slice(0, 12);
      await setDoc(doc(db, 'chats', dmId), {
        type: 'direct',
        name: 'DM: ' + fromName,
        createdBy: state.user.uid,
        participantIds: pair,
        lastMessage: 'Friend connection accepted!',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    }
  },
  async votePoll(pollId, optionIdx) {
    if (!db || !state.user) throw new Error('Sign in to cast verified cloud votes.');
    const pollRef = doc(db, 'polls', pollId);
    const voteRef = doc(db, 'polls', pollId, 'votes', state.user.uid);
    const existingVote = await getDoc(voteRef);
    if (existingVote.exists()) throw new Error('You have already voted in this poll.');
    const pSnap = await getDoc(pollRef);
    if (!pSnap.exists()) return;
    const p = pSnap.data();
    const counts = Array.isArray(p.counts) ? p.counts.slice() : [];
    counts[optionIdx] = (counts[optionIdx] || 0) + 1;
    await setDoc(voteRef, { userId: state.user.uid, optionIndex: optionIdx, createdAt: serverTimestamp() });
    await updateDoc(pollRef, { counts, totalVotes: (p.totalVotes || 0) + 1, updatedAt: serverTimestamp() });
  },
  async createPoll(title, category, options) {
    if (!db || !state.user) throw new Error('Sign in to create polls.');
    const closes = new Date(Date.now() + 7 * 86400000);
    await addDoc(collection(db, 'polls'), {
      category: category || 'community',
      title: title.slice(0, 160),
      options,
      counts: options.map(() => 0),
      totalVotes: 0,
      closesAt: closes,
      createdBy: state.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },
  async saveFantasy(teamName, formation, playerIds, totalPoints) {
    if (!db || !state.user) return;
    const ref = doc(db, 'fantasyTeams', state.user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { teamName, formation, playerIds, totalPoints, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { userId: state.user.uid, teamName, formation, playerIds, totalPoints, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
  },
  async savePrediction(matchId, matchTitle, homeScore, awayScore) {
    if (!db || !state.user) return;
    const docId = state.user.uid.slice(0, 14) + '_' + String(matchId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
    await setDoc(doc(db, 'predictions', docId), {
      userId: state.user.uid,
      matchId: String(matchId),
      matchTitle: String(matchTitle).slice(0, 120),
      homeScore: Number(homeScore),
      awayScore: Number(awayScore),
      createdAt: serverTimestamp()
    });
  },
  async toggleSavedArticle(article) {
    if (!db || !state.user) return;
    const cleanId = String(article.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
    const docId = state.user.uid.slice(0, 16) + '_' + cleanId;
    const ref = doc(db, 'savedArticles', docId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
      return false;
    }
    await setDoc(ref, {
      userId: state.user.uid,
      articleId: cleanId,
      title: String(article.title).slice(0, 240),
      url: String(article.url || 'https://www.espn.com/soccer/').slice(0, 512),
      source: String(article.source || 'STR News').slice(0, 80),
      imageUrl: String(article.imageUrl || '').slice(0, 512),
      publishedAt: String(article.publishedAt || ''),
      savedAt: serverTimestamp()
    });
    return true;
  },
  async saveSimMatch(entry) {
    if (!db || !state.user) return;
    await addDoc(collection(db, 'simMatches'), {
      userId: state.user.uid,
      mode: entry.mode,
      competitionLabel: entry.competitionLabel,
      homeTeamId: entry.homeTeamId,
      homeName: entry.homeName,
      awayTeamId: entry.awayTeamId,
      awayName: entry.awayName,
      homeScore: entry.homeScore,
      awayScore: entry.awayScore,
      homePenScore: entry.homePenScore || 0,
      awayPenScore: entry.awayPenScore || 0,
      wentToExtraTime: Boolean(entry.wentToExtraTime),
      wentToPenalties: Boolean(entry.wentToPenalties),
      formationHome: entry.formationHome,
      formationAway: entry.formationAway,
      manOfTheMatch: entry.manOfTheMatch,
      motmRating: entry.motmRating,
      summaryLine: entry.summaryLine,
      possessionHome: entry.possessionHome,
      shotsHome: entry.shotsHome,
      shotsAway: entry.shotsAway,
      keyEvents: entry.keyEvents || [],
      createdAt: serverTimestamp()
    }).catch(() => {});
  }
};
