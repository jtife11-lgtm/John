import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Check,
  CheckCheck,
  Edit3,
  Flame,
  Flag,
  Gamepad2,
  Image as ImageIcon,
  Info,
  Layers,
  MessageSquare,
  Mic,
  Newspaper,
  Palette,
  Phone,
  PhoneOff,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Sparkles,
  Square,
  Trash2,
  Trophy,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import {
  ANIMATED_FOOTBALL_STICKERS,
  CHAT_EMOJIS,
  PLAYER_CARDS_CATALOG,
  QUICK_REACTIONS,
} from '../data/playerCardsCatalog';
import { PlayerCardVisual } from './PlayerCardVisual';
import type { MatchItem, NewsArticle } from '../types/str';

const CHAT_BACKGROUNDS: Record<string, { label: string; className: string }> = {
  classic: { label: 'Obsidian Dark', className: 'bg-white dark:bg-[#0F1219]' },
  crimson: {
    label: 'Crimson Matchnight',
    className: 'bg-gradient-to-b from-[#2A0812]/80 via-[#0F1219] to-[#07090F]',
  },
  pitch: {
    label: 'Floodlit Pitch',
    className: 'bg-gradient-to-b from-slate-900 via-[#0C121D] to-[#07090F]',
  },
  derby: {
    label: 'Derby Arena',
    className: 'bg-gradient-to-br from-[#3B0A18]/60 via-[#0F1219] to-[#07090F]',
  },
};

function getUtcDateKey(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

function getMilestoneBadge(count: number): string | null {
  if (count === 3) return '3d Spark';
  if (count === 7) return '7d Matchday Flame';
  if (count === 14) return '14d Derby Duo';
  if (count === 30) return '30d Golden Streak';
  if (count === 100) return '100d Club Legends';
  return null;
}

export function CommunityHub() {
  const {
    user,
    userProfile,
    userPrivate,
    wsRef,
    pushToast,
    setActiveTab,
    setPendingChallengeId,
    setSelectedMatchForDetail,
    setShowAuthModal,
    setAuthModalMode,
    notifications,
    markNotificationRead,
  } = useApp();

  const [rooms, setRooms] = useState<any[]>([]);
  const [channelsChecked, setChannelsChecked] = useState(false);
  const [activeRoom, setActiveRoom] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgText, setEditMsgText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [msgSearch, setMsgSearch] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);

  // Pickers & Popovers
  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);
  const [showAttachDrawer, setShowAttachDrawer] = useState<'none' | 'card' | 'match' | 'news' | 'bg'>('none');
  const [liveMatchesCache, setLiveMatchesCache] = useState<MatchItem[]>([]);
  const [liveNewsCache, setLiveNewsCache] = useState<NewsArticle[]>([]);
  const [goalBlast, setGoalBlast] = useState(false);

  // Media & Voice recording
  const [pendingMedia, setPendingMedia] = useState<{
    type: 'image' | 'video' | 'voice';
    data: string;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const threadBottomRef = useRef<HTMLDivElement | null>(null);
  const seededOnceRef = useRef(false);

  // Friends, Users & Streaks
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [streaks, setStreaks] = useState<any[]>([]);
  const [sideTab, setSideTab] = useState<'rooms' | 'friends' | 'streaks'>('rooms');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendProfileModal, setFriendProfileModal] = useState<any | null>(null);
  const [inviteFriendTarget, setInviteFriendTarget] = useState<{ uid: string; name: string } | null>(null);
  const [showStreakRules, setShowStreakRules] = useState(false);

  // New Group Chat
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupAvatar, setNewGroupAvatar] = useState('');
  const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState<string[]>([]);

  // Edit Group Chat
  const [editingGroup, setEditingGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');

  // WebRTC Call State
  const [callState, setCallState] = useState<{
    active: boolean;
    peerUid: string;
    peerName: string;
    video: boolean;
    status: string;
  } | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const blockedUids = userPrivate?.blockedUids || [];

  const safeWsSend = (payload: unknown) => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
    } catch {
      // Ignore socket send errors when reconnecting
    }
  };

  // Derived message filters
  const pinnedMessages = messages.filter((m) => m.pinned && !m.deleted);
  const visibleMessages = useMemo(() => {
    return messages.filter((m) => {
      if (blockedUids.includes(m.senderId)) return false;
      if (msgSearch.trim()) {
        const q = msgSearch.toLowerCase();
        return (
          (m.text || '').toLowerCase().includes(q) ||
          (m.senderName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [messages, blockedUids, msgSearch]);

  // Seed default club channels idempotently (check before write)
  const ensureStarterChannels = async () => {
    if (!user) return;
    const channels = [
      { id: 'channel_global', name: 'Global Football Lounge', clubTag: 'World Football' },
      { id: 'channel_pl', name: 'Premier League Fans', clubTag: 'Premier League' },
      { id: 'channel_ucl', name: 'Champions League Nights', clubTag: 'UEFA UCL' },
      { id: 'channel_lebanon', name: 'Lebanese Football Room', clubTag: 'Lebanese League' },
    ];
    for (const ch of channels) {
      const ref = doc(db, 'chats', ch.id);
      const existing = await getDoc(ref).catch(() => null);
      if (!existing?.exists()) {
        await setDoc(ref, {
          type: 'channel',
          name: ch.name,
          clubTag: ch.clubTag,
          backgroundTheme: 'classic',
          createdBy: user.uid,
          participantIds: [user.uid],
          lastMessage: 'Welcome to the matchday lounge!',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    }
  };

  // Real-time listeners for Chats, Users, FriendRequests, and Streaks
  useEffect(() => {
    if (!user) return;
    const unsubChannels = onSnapshot(
      query(collection(db, 'chats'), where('type', '==', 'channel')),
      (snap) => {
        const ch = snap.docs
          .filter((d) => !d.metadata.hasPendingWrites)
          .map((d) => ({ id: d.id, ...d.data() }));
        setRooms((prev) => {
          const nonCh = prev.filter((r) => r.type !== 'channel');
          return [...ch, ...nonCh];
        });
        setChannelsChecked(true);
      },
      (err) => {
        setChannelsChecked(true);
        handleFirestoreError(err, OperationType.LIST, 'chats');
      }
    );

    const unsubMyRooms = onSnapshot(
      query(collection(db, 'chats'), where('participantIds', 'array-contains', user.uid)),
      (snap) => {
        const mine = snap.docs
          .filter((d) => !d.metadata.hasPendingWrites)
          .map((d) => ({ id: d.id, ...d.data() }));
        setRooms((prev) => {
          const onlyCh = prev.filter((r) => r.type === 'channel');
          const merged = [...onlyCh];
          mine.forEach((m) => {
            const idx = merged.findIndex((x) => x.id === m.id);
            if (idx >= 0) merged[idx] = m;
            else merged.push(m);
          });
          return merged;
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'chats')
    );

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), limit(80)),
      (snap) => setAllUsers(snap.docs.map((d) => d.data()).filter((u) => u.uid !== user.uid)),
      () => {}
    );

    const unsubFromReqs = onSnapshot(
      query(collection(db, 'friendRequests'), where('fromUid', '==', user.uid)),
      (snap) => {
        const fromList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFriendRequests((prev) => [...prev.filter((r) => r.fromUid !== user.uid), ...fromList]);
      },
      () => {}
    );

    const unsubToReqs = onSnapshot(
      query(collection(db, 'friendRequests'), where('toUid', '==', user.uid)),
      (snap) => {
        const toList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFriendRequests((prev) => [...prev.filter((r) => r.toUid !== user.uid), ...toList]);
      },
      () => {}
    );

    const unsubStreaks = onSnapshot(
      query(collection(db, 'streaks'), orderBy('count', 'desc'), limit(25)),
      (snap) => setStreaks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );

    return () => {
      unsubChannels();
      unsubMyRooms();
      unsubUsers();
      unsubFromReqs();
      unsubToReqs();
      unsubStreaks();
    };
  }, [user]);

  // Auto-seed starter rooms once if Firestore channels collection is empty
  useEffect(() => {
    if (!user || !channelsChecked || seededOnceRef.current) return;
    const hasChannels = rooms.some((r) => r.type === 'channel');
    if (!hasChannels) {
      seededOnceRef.current = true;
      ensureStarterChannels();
    }
  }, [user, channelsChecked, rooms]);

  // Keep activeRoom synced with updates
  useEffect(() => {
    if (!activeRoom && rooms.length > 0) {
      setActiveRoom(rooms[0]);
    } else if (activeRoom) {
      const updated = rooms.find((r) => r.id === activeRoom.id);
      if (updated) setActiveRoom(updated);
    }
  }, [rooms]);

  // Load messages + mark read receipts + clear unread chat notifications for active room
  useEffect(() => {
    if (!user || !activeRoom) {
      setMessages([]);
      return;
    }

    safeWsSend({ type: 'join_room', roomId: activeRoom.id });
    safeWsSend({ type: 'read_receipt', roomId: activeRoom.id });

    notifications
      .filter((n: any) => !n.read && n.roomId === activeRoom.id)
      .forEach((n) => markNotificationRead(n.id));

    let cancelled = false;
    let unsub: (() => void) | null = null;

    const attachMessagesListener = async () => {
      // Ensure the parent chat document exists on Firestore server before querying subcollection
      let ready = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        if (cancelled) return;
        try {
          const parentSnap = await getDocFromServer(doc(db, 'chats', activeRoom.id));
          if (parentSnap.exists()) {
            ready = true;
            break;
          }
        } catch {
          // Wait briefly if newly created doc is still propagating
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (cancelled || !ready) return;

      unsub = onSnapshot(
        query(
          collection(db, 'chats', activeRoom.id, 'messages'),
          orderBy('createdAt', 'asc'),
          limit(120)
        ),
        (snap) => {
          const list: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setMessages(list);

          if (list.length > 0) {
            const lastForeign = [...list]
              .reverse()
              .find((m: any) => m.senderId !== user.uid && !(m.readBy || []).includes(user.uid));
            if (lastForeign) {
              const nextRead = Array.from(new Set([...(lastForeign.readBy || []), user.uid])).slice(0, 50);
              updateDoc(doc(db, 'chats', activeRoom.id, 'messages', lastForeign.id), {
                readBy: nextRead,
              }).catch(() => {});
            }
          }
          setTimeout(() => threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
        },
        (err) => {
          console.error('Messages listener error:', err);
        }
      );
    };

    attachMessagesListener();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [user, activeRoom?.id]);

  // WebSocket listener for typing, read receipts, game invites & WebRTC calls
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const handler = async (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'typing' && data.roomId === activeRoom?.id && data.uid !== user?.uid) {
          setTypingUsers((prev) => {
            const copy = { ...prev };
            if (data.isTyping) copy[data.uid] = data.displayName || 'Supporter';
            else delete copy[data.uid];
            return copy;
          });
        }
        if (data.type === 'game_invite') {
          pushToast(`${data.fromName} challenged you to ${data.gameType}! Check Games Hub.`, 'info');
        }
        if (data.type === 'streak_milestone') {
          triggerGoalBlast();
          pushToast(`🔥 Streak Milestone with ${data.fromName}: ${data.count} days!`, 'success');
        }
        if (data.type === 'call_offer' && data.offer) {
          await handleIncomingOffer(data);
        }
        if (data.type === 'call_answer' && data.answer && pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          setCallState((c) => (c ? { ...c, status: 'Connected' } : c));
        }
        if (data.type === 'call_ice' && data.candidate && pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        }
        if (data.type === 'call_end') {
          endCall(false);
          pushToast('Call ended', 'info');
        }
      } catch {
        // Ignore malformed frame
      }
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [wsRef.current, activeRoom?.id, user?.uid]);

  const triggerGoalBlast = () => {
    setGoalBlast(true);
    setTimeout(() => setGoalBlast(false), 1800);
  };

  // Authentic Fair Streak Progression (Only on genuine DM message exchange!)
  const recordAuthenticStreak = async (room: any) => {
    if (!user || room.type !== 'direct') return;
    const peerUid = (room.participantIds || []).find((id: string) => id !== user.uid);
    if (!peerUid) return;

    const sortedIds = [user.uid, peerUid].sort();
    const streakId = sortedIds.join('_').slice(0, 120);
    const peerUser = allUsers.find((u) => u.uid === peerUid);
    const myName = (userProfile?.displayName || user.displayName || 'Supporter').slice(0, 64);
    const peerName = (peerUser?.displayName || 'Friend').slice(0, 64);

    const today = getUtcDateKey(0);
    const yesterday = getUtcDateKey(-1);
    const existing = streaks.find((s) => s.id === streakId);

    if (!existing) {
      await setDoc(doc(db, 'streaks', streakId), {
        userA: sortedIds[0],
        userB: sortedIds[1],
        nameA: sortedIds[0] === user.uid ? myName : peerName,
        nameB: sortedIds[1] === user.uid ? myName : peerName,
        participantIds: sortedIds,
        count: 0,
        bestCount: 0,
        lastSenderId: user.uid,
        lastActiveDate: today,
        todaySenders: [user.uid],
        badges: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      return;
    }

    const prevDate: string = existing.lastActiveDate || '';
    const prevTodaySenders: string[] = Array.isArray(existing.todaySenders) ? existing.todaySenders : [];
    const currentCount = Number(existing.count || 0);
    const prevBest = Number(existing.bestCount || 0);
    const prevBadges: string[] = Array.isArray(existing.badges) ? existing.badges : [];

    if (prevDate === today && prevTodaySenders.includes(user.uid)) {
      return;
    }

    let nextCount = currentCount;
    let nextTodaySenders: string[] = [];

    if (prevDate === today) {
      nextTodaySenders = Array.from(new Set([...prevTodaySenders, user.uid])).slice(0, 2);
      if (nextTodaySenders.length === 2) {
        nextCount = currentCount + 1;
      }
    } else if (prevDate === yesterday && prevTodaySenders.length === 2) {
      nextTodaySenders = [user.uid];
    } else {
      nextCount = 0;
      nextTodaySenders = [user.uid];
    }

    const nextBest = Math.max(prevBest, nextCount);
    const milestone = nextCount > currentCount ? getMilestoneBadge(nextCount) : null;
    const nextBadges = milestone ? Array.from(new Set([...prevBadges, milestone])).slice(0, 15) : prevBadges;

    await updateDoc(doc(db, 'streaks', streakId), {
      count: nextCount,
      bestCount: nextBest,
      lastSenderId: user.uid,
      lastActiveDate: today,
      todaySenders: nextTodaySenders,
      badges: nextBadges,
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    if (milestone) {
      triggerGoalBlast();
      pushToast(`🔥 STR Streak Milestone reached: ${nextCount} days (${milestone})!`, 'success');
      safeWsSend({ type: 'streak_milestone', targetUid: peerUid, count: nextCount });
      await addDoc(collection(db, 'notifications'), {
        userId: peerUid,
        senderUid: user.uid,
        roomId: room.id,
        type: 'streak',
        title: `🔥 ${nextCount}-Day Streak Milestone!`,
        body: `You and ${myName} unlocked ${milestone}.`,
        read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  const seedClubChannels = async () => {
    if (!user) return;
    await ensureStarterChannels();
    pushToast('Club channels ready!', 'success');
  };

  const sendMessage = async (
    e?: React.FormEvent,
    override?: {
      text: string;
      mediaType: 'text' | 'image' | 'video' | 'voice' | 'card' | 'sticker' | 'match' | 'news' | 'invite';
      mediaData?: string;
      metadata?: string;
    }
  ) => {
    e?.preventDefault();
    if (!user || !activeRoom || sending) return;

    const textToSend = override ? override.text : msgText.trim();
    const mediaType = override ? override.mediaType : pendingMedia ? pendingMedia.type : 'text';

    if (!textToSend && !pendingMedia && !override) return;

    const senderName = (userProfile?.displayName || user.displayName || 'Supporter').slice(0, 64);
    const payload: any = {
      senderId: user.uid,
      senderName,
      text: textToSend.slice(0, 2000),
      mediaType,
      readBy: [user.uid],
      createdAt: serverTimestamp(),
    };
    if (override?.mediaData) payload.mediaData = override.mediaData.slice(0, 195000);
    else if (pendingMedia) payload.mediaData = pendingMedia.data.slice(0, 195000);

    if (override?.metadata) payload.metadata = override.metadata.slice(0, 3900);
    if (replyTo) payload.replyToId = replyTo.id;

    setSending(true);
    try {
      await addDoc(collection(db, 'chats', activeRoom.id, 'messages'), payload);
      await updateDoc(doc(db, 'chats', activeRoom.id), {
        lastMessage: (textToSend || `[${mediaType}]`).slice(0, 500),
        updatedAt: serverTimestamp(),
      });

      if (/gooo*al|⚽💥/i.test(textToSend)) {
        triggerGoalBlast();
      }

      if (!override) {
        setMsgText('');
        setPendingMedia(null);
      }
      setReplyTo(null);
      setShowEmojiDrawer(false);
      setShowAttachDrawer('none');
      safeWsSend({ type: 'typing', roomId: activeRoom.id, isTyping: false });

      // Notify DM peer or Group participants via WS & Firestore notifications
      const preview = (textToSend || `[${mediaType}]`).slice(0, 120);
      if (activeRoom.type === 'direct') {
        const peerUid = (activeRoom.participantIds || []).find((x: string) => x !== user.uid);
        if (peerUid) {
          safeWsSend({ type: 'chat_message', roomId: activeRoom.id, targetUid: peerUid, preview });
          await addDoc(collection(db, 'notifications'), {
            userId: peerUid,
            senderUid: user.uid,
            roomId: activeRoom.id,
            type: 'chat',
            title: `New message from ${senderName}`,
            body: preview,
            read: false,
            createdAt: serverTimestamp(),
          }).catch(() => {});
        }
      } else {
        safeWsSend({ type: 'chat_message', roomId: activeRoom.id, preview });
      }

      await recordAuthenticStreak(activeRoom);
    } catch (err: any) {
      console.error('Send message error:', err);
      pushToast(err?.message || 'Unable to send message right now. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  const saveEditMessage = async (msgId: string) => {
    if (!user || !activeRoom || !editMsgText.trim()) return;
    try {
      await updateDoc(doc(db, 'chats', activeRoom.id, 'messages', msgId), {
        text: editMsgText.trim().slice(0, 2000),
        editedAt: serverTimestamp(),
      });
      setEditingMsgId(null);
      setEditMsgText('');
      pushToast('Message edited', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'Unable to edit message.', 'error');
    }
  };

  const deleteOwnMessage = async (msgId: string) => {
    if (!user || !activeRoom) return;
    await updateDoc(doc(db, 'chats', activeRoom.id, 'messages', msgId), {
      text: 'This message was deleted',
      deleted: true,
      editedAt: serverTimestamp(),
    }).catch((err) => pushToast(err?.message || 'Could not delete message.', 'error'));
  };

  const togglePinMessage = async (msg: any) => {
    if (!user || !activeRoom) return;
    const nextPinned = !msg.pinned;
    await updateDoc(doc(db, 'chats', activeRoom.id, 'messages', msg.id), {
      pinned: nextPinned,
    }).catch(() => {});
    pushToast(nextPinned ? 'Message pinned to room!' : 'Message unpinned.', 'info');
  };

  const updateRoomBackground = async (themeKey: string) => {
    if (!user || !activeRoom) return;
    await updateDoc(doc(db, 'chats', activeRoom.id), {
      backgroundTheme: themeKey,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    setShowAttachDrawer('none');
    pushToast(`Chat background updated: ${CHAT_BACKGROUNDS[themeKey]?.label}`, 'success');
  };

  const openShareMatchDrawer = async () => {
    setShowAttachDrawer((prev) => (prev === 'match' ? 'none' : 'match'));
    if (liveMatchesCache.length === 0) {
      const d = await fetch('/api/football/scoreboard?league=all').then((r) => r.json()).catch(() => ({ matches: [] }));
      setLiveMatchesCache(Array.isArray(d.matches) ? d.matches.slice(0, 12) : []);
    }
  };

  const openShareNewsDrawer = async () => {
    setShowAttachDrawer((prev) => (prev === 'news' ? 'none' : 'news'));
    if (liveNewsCache.length === 0) {
      const d = await fetch('/api/news/football?category=all').then((r) => r.json()).catch(() => ({ articles: [] }));
      setLiveNewsCache(Array.isArray(d.articles) ? d.articles.slice(0, 10) : []);
    }
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 140_000) {
      pushToast('Please pick a photo/clip under 140KB for instant chat sharing.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPendingMedia({
          type: file.type.startsWith('video') ? 'video' : 'image',
          data: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGroupAvatarAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 140_000) {
      pushToast('Group icon must be under 140KB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setNewGroupAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const toggleVoiceRecord = async () => {
    if (recording) {
      mediaRecRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 140_000) {
          pushToast('Voice note too long — keep voice clips concise (under ~8 seconds).', 'info');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setPendingMedia({ type: 'voice', data: reader.result });
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      pushToast('Microphone permission is required to record voice messages.', 'error');
    }
  };

  const reactToMessage = async (msg: any, emoji: string) => {
    if (!user || !activeRoom) return;
    const reactions = { ...(msg.reactions || {}) };
    reactions[emoji] = (reactions[emoji] || 0) + 1;
    await updateDoc(doc(db, 'chats', activeRoom.id, 'messages', msg.id), { reactions }).catch(() => {});
  };

  const sendFriendRequest = async (target: any) => {
    if (!user) return;
    const myName = (userProfile?.displayName || user.displayName || 'Supporter').slice(0, 64);
    const reqId = `${user.uid}_${target.uid}`.slice(0, 120);
    try {
      await setDoc(doc(db, 'friendRequests', reqId), {
        fromUid: user.uid,
        toUid: target.uid,
        fromName: myName,
        toName: target.displayName || 'Supporter',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'notifications'), {
        userId: target.uid,
        senderUid: user.uid,
        type: 'friend',
        title: 'New Friend Request',
        body: `${myName} wants to connect with you on STR Chat.`,
        read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {});
      pushToast(`Friend request sent to ${target.displayName}`, 'success');
    } catch (err: any) {
      pushToast(err?.message || 'Could not send friend request.', 'error');
    }
  };

  const cancelOrRemoveFriendReq = async (reqId: string, label: string) => {
    await deleteDoc(doc(db, 'friendRequests', reqId)).catch(() => {});
    pushToast(label, 'info');
  };

  const respondFriendRequest = async (req: any, status: 'accepted' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'friendRequests', req.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      if (status === 'accepted' && user) {
        const dmId = [req.fromUid, req.toUid].sort().join('_').slice(0, 120);
        const dmRef = doc(db, 'chats', dmId);
        const dmSnap = await getDoc(dmRef).catch(() => null);
        if (!dmSnap?.exists()) {
          await setDoc(dmRef, {
            type: 'direct',
            name: `${req.fromName} & ${req.toName}`.slice(0, 80),
            backgroundTheme: 'classic',
            createdBy: user.uid,
            participantIds: [req.fromUid, req.toUid],
            lastMessage: 'Say hello to start your STR Streak!',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await addDoc(collection(db, 'notifications'), {
          userId: req.fromUid,
          senderUid: user.uid,
          roomId: dmId,
          type: 'friend',
          title: 'Friend Request Accepted',
          body: `${req.toName} accepted your friend request!`,
          read: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
        pushToast('Friend added & private DM created!', 'success');
      }
    } catch (err: any) {
      pushToast(err?.message || 'Unable to respond to friend request.', 'error');
    }
  };

  const openDirectChat = async (friendUid: string, friendName: string) => {
    if (!user) return;
    const dmId = [user.uid, friendUid].sort().join('_').slice(0, 120);
    const existing = rooms.find((r) => r.id === dmId);
    if (existing) {
      setActiveRoom(existing);
      setSideTab('rooms');
      return;
    }
    const myName = (userProfile?.displayName || user.displayName || 'Supporter').slice(0, 36);
    const dmRef = doc(db, 'chats', dmId);
    const newRoom = {
      type: 'direct',
      name: `${myName} & ${friendName}`.slice(0, 80),
      backgroundTheme: 'classic',
      createdBy: user.uid,
      participantIds: [user.uid, friendUid],
      lastMessage: 'Private chat started',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      const dmSnap = await getDoc(dmRef).catch(() => null);
      if (dmSnap?.exists()) {
        setActiveRoom({ id: dmId, ...dmSnap.data() });
      } else {
        await setDoc(dmRef, newRoom);
        setActiveRoom({ id: dmId, ...newRoom });
      }
      setSideTab('rooms');
    } catch (err: any) {
      pushToast(err?.message || 'Unable to start direct chat.', 'error');
    }
  };

  const saveGroupMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeRoom || activeRoom.type !== 'group' || !editGroupName.trim()) return;
    await updateDoc(doc(db, 'chats', activeRoom.id), {
      name: editGroupName.trim().slice(0, 80),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    setEditingGroup(false);
    pushToast('Group info updated!', 'success');
  };

  const sendGameInvite = async (
    targetUid: string,
    targetName: string,
    gameType: 'penalty' | 'free_kick' | 'trivia_blitz' | 'reflex_save' | 'quiz' | 'higher_lower' | 'card_battle'
  ) => {
    if (!user) return;
    const myName = userProfile?.displayName || user.displayName || 'Supporter';
    try {
      const seed = Math.floor(Math.random() * 100000);
      const ref = await addDoc(collection(db, 'gameChallenges'), {
        fromUid: user.uid,
        toUid: targetUid,
        fromName: myName,
        toName: targetName,
        gameType,
        status: 'pending',
        fromScore: 0,
        toScore: 0,
        seed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      safeWsSend({ type: 'game_invite', targetUid, gameType, challengeId: ref.id });

      const dmId = [user.uid, targetUid].sort().join('_').slice(0, 120);
      await setDoc(
        doc(db, 'chats', dmId),
        {
          type: 'direct',
          name: `${myName} & ${targetName}`.slice(0, 80),
          backgroundTheme: 'classic',
          createdBy: user.uid,
          participantIds: [user.uid, targetUid],
          lastMessage: `Game Challenge: ${gameType.replace('_', ' ')}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await addDoc(collection(db, 'chats', dmId, 'messages'), {
        senderId: user.uid,
        senderName: myName,
        text: `Challenged ${targetName} to ${gameType.replace('_', ' ')}!`,
        mediaType: 'invite',
        metadata: JSON.stringify({ challengeId: ref.id, gameType }),
        readBy: [user.uid],
        createdAt: serverTimestamp(),
      }).catch(() => {});

      await addDoc(collection(db, 'notifications'), {
        userId: targetUid,
        senderUid: user.uid,
        roomId: dmId,
        type: 'challenge',
        title: `New Game Challenge from ${myName}`,
        body: `Accept ${gameType.replace('_', ' ')} duel in STR Games!`,
        read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {});

      setInviteFriendTarget(null);
      pushToast(`Challenge sent to ${targetName}!`, 'success');
    } catch (err: any) {
      pushToast(err?.message || 'Unable to send challenge.', 'error');
    }
  };

  const createGroupChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newGroupName.trim()) return;
    const id = `grp_${Date.now()}`;
    const participants = Array.from(new Set([user.uid, ...selectedFriendsForGroup])).slice(0, 50);
    try {
      const groupObj = {
        type: 'group',
        name: newGroupName.trim().slice(0, 80),
        avatarUrl: newGroupAvatar,
        backgroundTheme: 'classic',
        createdBy: user.uid,
        participantIds: participants,
        lastMessage: 'Group chat created',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'chats', id), groupObj);
      setActiveRoom({ id, ...groupObj });
      setNewGroupName('');
      setNewGroupAvatar('');
      setSelectedFriendsForGroup([]);
      setShowNewGroup(false);
      pushToast('Group chat created!', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'Unable to create group chat.', 'error');
    }
  };

  const blockUser = async (targetUid: string) => {
    if (!user) return;
    const next = Array.from(new Set([...blockedUids, targetUid])).slice(0, 100);
    await updateDoc(doc(db, 'users', user.uid, 'private', 'info'), {
      blockedUids: next,
      updatedAt: serverTimestamp(),
    });
    pushToast('User blocked. Their messages are now hidden.', 'info');
  };

  const reportItem = async (targetType: 'user' | 'message', targetId: string) => {
    if (!user) return;
    const repId = `rep_${Date.now()}`;
    await setDoc(doc(db, 'reports', repId), {
      reporterId: user.uid,
      targetType,
      targetId: targetId.slice(0, 128),
      reason: 'Reported via STR Chat moderation menu',
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    pushToast('Report submitted for admin review.', 'success');
  };

  // WebRTC Voice / Video Call helpers
  const startCall = async (targetUid: string, targetName: string, withVideo: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      pushToast('Real-time signaling socket is connecting — try again in a second.', 'info');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
      localStreamRef.current = stream;
      setCallState({
        active: true,
        peerUid: targetUid,
        peerName: targetName,
        video: withVideo,
        status: 'Calling...',
      });
      setTimeout(() => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }, 100);

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;
      stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
      pc.ontrack = (ev) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = ev.streams[0];
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          safeWsSend({ type: 'call_ice', targetUid, candidate: ev.candidate });
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      safeWsSend({ type: 'call_offer', targetUid, offer, video: withVideo });
    } catch {
      pushToast('Camera or microphone permission denied.', 'error');
    }
  };

  const handleIncomingOffer = async (data: any) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: Boolean(data.video) });
      localStreamRef.current = stream;
      setCallState({
        active: true,
        peerUid: data.fromUid,
        peerName: data.fromName || 'Supporter',
        video: Boolean(data.video),
        status: 'Connected',
      });
      setTimeout(() => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }, 100);

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;
      stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
      pc.ontrack = (ev) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = ev.streams[0];
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          safeWsSend({ type: 'call_ice', targetUid: data.fromUid, candidate: ev.candidate });
        }
      };
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      safeWsSend({ type: 'call_answer', targetUid: data.fromUid, answer });
    } catch {
      pushToast('Incoming call missed — media permission required.', 'info');
    }
  };

  const endCall = (notifyPeer = true) => {
    if (notifyPeer && callState?.peerUid) {
      safeWsSend({ type: 'call_end', targetUid: callState.peerUid });
    }
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setCallState(null);
  };

  if (!user) {
    return (
      <div className="rounded-3xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-10 text-center space-y-4 max-w-xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-[#E11D48]/15 border border-[#E11D48]/30 flex items-center justify-center mx-auto">
          <MessageSquare className="w-7 h-7 text-[#E11D48]" />
        </div>
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
          STR Chat, Friends & Streaks
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sign in or create a free account to chat in real time, search & add friends, build daily STR Streaks, trade Player Cards, and start voice or video calls.
        </p>
        <div className="flex justify-center gap-3 pt-1">
          <button
            onClick={() => {
              setAuthModalMode('signin');
              setShowAuthModal(true);
            }}
            className="px-6 py-2.5 rounded-xl bg-[#E11D48] text-white font-bold text-sm hover:bg-[#BE123C] transition"
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setAuthModalMode('signup');
              setShowAuthModal(true);
            }}
            className="px-6 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 text-sm font-semibold hover:border-[#E11D48]"
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  const acceptedFriends = friendRequests
    .filter((r) => r.status === 'accepted')
    .map((r) => {
      const friendUid = r.fromUid === user.uid ? r.toUid : r.fromUid;
      const friendName = r.fromUid === user.uid ? r.toName : r.fromName;
      const profileObj = allUsers.find((u) => u.uid === friendUid);
      const streakDoc = streaks.find(
        (s) => (s.participantIds || []).includes(friendUid) && (s.participantIds || []).includes(user.uid)
      );
      return {
        reqId: r.id,
        uid: friendUid,
        name: profileObj?.displayName || friendName,
        username: profileObj?.username || '',
        online: Boolean(profileObj?.online),
        favoriteTeams: profileObj?.favoriteTeams || [],
        bio: profileObj?.bio || '',
        points: profileObj?.points || 0,
        streakCount: Number(streakDoc?.count || 0),
        streakBadges: streakDoc?.badges || [],
      };
    });

  const onlineFriends = acceptedFriends.filter((f) => f.online);
  const recentFriends = acceptedFriends.filter((f) => !f.online);
  const incomingReqs = friendRequests.filter((r) => r.toUid === user.uid && r.status === 'pending');
  const outgoingReqs = friendRequests.filter((r) => r.fromUid === user.uid && r.status === 'pending');

  const discoverMatches = allUsers.filter((u) => {
    const q = friendSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.username?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.uid?.toLowerCase().includes(q)
    );
  });

  const activeBgClass =
    CHAT_BACKGROUNDS[activeRoom?.backgroundTheme || 'classic']?.className || CHAT_BACKGROUNDS.classic.className;

  const activeDmPeerUid =
    activeRoom?.type === 'direct'
      ? (activeRoom.participantIds || []).find((x: string) => x !== user.uid)
      : null;
  const activeDmFriend = activeDmPeerUid ? acceptedFriends.find((f) => f.uid === activeDmPeerUid) : null;
  const activeDmPeerProfile = activeDmPeerUid ? allUsers.find((u) => u.uid === activeDmPeerUid) : null;
  const activeDmPeerName = activeDmFriend?.name || activeDmPeerProfile?.displayName || 'Supporter';

  const myStreaks = streaks.filter((s) => (s.participantIds || []).includes(user.uid));

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <MessageSquare className="w-7 h-7 text-[#E11D48]" />
            STR Chat, Friends & Streaks
          </h1>
          <p className="text-xs text-slate-500">
            Your ID:{' '}
            <span className="font-mono-tabular select-all text-slate-700 dark:text-slate-300">
              {user.uid}
            </span>{' '}
            · @{userProfile?.username || 'supporter'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStreakRules(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold"
          >
            <Flame className="w-4 h-4" />
            Streak Rules
          </button>
          <button
            onClick={() => setShowNewGroup(!showNewGroup)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold hover:bg-[#BE123C] transition"
          >
            <Plus className="w-4 h-4" />
            New Group Chat
          </button>
        </div>
      </div>

      {/* New Group Chat Creator */}
      {showNewGroup && (
        <form
          onSubmit={createGroupChat}
          className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-4 space-y-3"
        >
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              required
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group chat name (e.g., Champions League Watchparty)"
              className="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs"
            />
            <label className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-[#E11D48]" />
              {newGroupAvatar ? 'Group Photo Ready ✓' : 'Group Picture'}
              <input type="file" accept="image/*" onChange={handleGroupAvatarAttach} className="hidden" />
            </label>
          </div>
          {acceptedFriends.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {acceptedFriends.map((fr) => {
                const checked = selectedFriendsForGroup.includes(fr.uid);
                return (
                  <button
                    type="button"
                    key={fr.uid}
                    onClick={() =>
                      setSelectedFriendsForGroup((p) =>
                        checked ? p.filter((x) => x !== fr.uid) : [...p, fr.uid]
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                      checked ? 'bg-[#E11D48] text-white border-[#E11D48]' : 'border-slate-300 dark:border-white/15'
                    }`}
                  >
                    {fr.name}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold hover:bg-[#BE123C]"
          >
            Create Group
          </button>
        </form>
      )}

      <div className="grid lg:grid-cols-12 gap-4 min-h-[580px]">
        {/* Sidebar: Rooms / Friends / Streaks */}
        <aside className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-slate-200 dark:border-white/10 grid grid-cols-3 gap-1">
            <button
              onClick={() => setSideTab('rooms')}
              className={`py-2 rounded-xl text-xs font-semibold transition ${
                sideTab === 'rooms' ? 'bg-[#E11D48] text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              Chats ({rooms.length})
            </button>
            <button
              onClick={() => setSideTab('friends')}
              className={`relative py-2 rounded-xl text-xs font-semibold transition ${
                sideTab === 'friends' ? 'bg-[#E11D48] text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              Friends ({acceptedFriends.length})
              {incomingReqs.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white text-[#E11D48] text-[10px] font-bold">
                  {incomingReqs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSideTab('streaks')}
              className={`py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1 transition ${
                sideTab === 'streaks' ? 'bg-[#E11D48] text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Streaks
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[540px]">
            {/* ROOMS TAB */}
            {sideTab === 'rooms' && (
              <>
                {rooms.length === 0 ? (
                  <div className="py-8 text-center space-y-3">
                    <p className="text-xs text-slate-500">Setting up club lounges...</p>
                    <button
                      onClick={seedClubChannels}
                      className="px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
                    >
                      Launch Club Channels
                    </button>
                  </div>
                ) : (
                  rooms.map((r) => {
                    const peerUid = r.type === 'direct' ? (r.participantIds || []).find((x: string) => x !== user.uid) : null;
                    const peerProf = peerUid ? allUsers.find((u) => u.uid === peerUid) : null;
                    const streakObj = peerUid
                      ? myStreaks.find((s) => (s.participantIds || []).includes(peerUid))
                      : null;
                    const roomUnread = notifications.filter((n: any) => !n.read && n.roomId === r.id).length;

                    return (
                      <button
                        key={r.id}
                        onClick={() => setActiveRoom(r)}
                        className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${
                          activeRoom?.id === r.id
                            ? 'bg-[#E11D48]/15 border-[#E11D48]'
                            : 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/5 hover:border-[#E11D48]/40'
                        }`}
                      >
                        <div className="relative shrink-0">
                          {r.avatarUrl ? (
                            <img
                              src={r.avatarUrl}
                              alt={r.name}
                              className="w-9 h-9 rounded-xl object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-[#E11D48]/15 border border-[#E11D48]/30 flex items-center justify-center">
                              <MessageSquare className="w-4 h-4 text-[#E11D48]" />
                            </div>
                          )}
                          {r.type === 'direct' && (
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#07090F] ${
                                peerProf?.online ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between text-xs font-bold gap-2">
                            <span className="truncate text-slate-900 dark:text-white">{r.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {roomUnread > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-[#E11D48] text-white text-[10px]">
                                  {roomUnread}
                                </span>
                              )}
                              {streakObj && streakObj.count > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[11px] font-mono-tabular text-amber-400">
                                  🔥 {streakObj.count}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 uppercase">{r.type}</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {r.lastMessage || r.clubTag}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}

            {/* FRIENDS TAB */}
            {sideTab === 'friends' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={friendSearchQuery}
                    onChange={(e) => setFriendSearchQuery(e.target.value)}
                    placeholder="Find by name, @username, or UID..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs focus:outline-none focus:border-[#E11D48]"
                  />
                </div>

                {incomingReqs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-[#E11D48]">Incoming Requests ({incomingReqs.length})</p>
                    {incomingReqs.map((req) => (
                      <div
                        key={req.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-[#E11D48]/30 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-semibold truncate">{req.fromName}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => respondFriendRequest(req, 'accepted')}
                            className="px-2.5 py-1 rounded bg-[#E11D48] text-white font-bold"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => respondFriendRequest(req, 'rejected')}
                            className="px-2 py-1 rounded bg-slate-700 text-white"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {outgoingReqs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-400">Sent Requests ({outgoingReqs.length})</p>
                    {outgoingReqs.map((req) => (
                      <div
                        key={req.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate">{req.toName}</span>
                        <button
                          onClick={() => cancelOrRemoveFriendReq(req.id, 'Friend request cancelled')}
                          className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[11px] font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {onlineFriends.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-emerald-400">Online Friends ({onlineFriends.length})</p>
                    {onlineFriends.map((fr) => (
                      <FriendRow
                        key={fr.uid}
                        fr={fr}
                        onChat={() => openDirectChat(fr.uid, fr.name)}
                        onOpenProfile={() => setFriendProfileModal(fr)}
                        onCall={(v) => startCall(fr.uid, fr.name, v)}
                        onInvite={() => setInviteFriendTarget({ uid: fr.uid, name: fr.name })}
                        onRemove={() => cancelOrRemoveFriendReq(fr.reqId, `Removed ${fr.name} from friends`)}
                      />
                    ))}
                  </div>
                )}

                {recentFriends.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-400">Friends ({recentFriends.length})</p>
                    {recentFriends.map((fr) => (
                      <FriendRow
                        key={fr.uid}
                        fr={fr}
                        onChat={() => openDirectChat(fr.uid, fr.name)}
                        onOpenProfile={() => setFriendProfileModal(fr)}
                        onCall={(v) => startCall(fr.uid, fr.name, v)}
                        onInvite={() => setInviteFriendTarget({ uid: fr.uid, name: fr.name })}
                        onRemove={() => cancelOrRemoveFriendReq(fr.reqId, `Removed ${fr.name} from friends`)}
                      />
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-400">Discover Supporters ({discoverMatches.length})</p>
                  {discoverMatches.length === 0 ? (
                    <p className="text-[11px] text-slate-500">No supporters matched your search.</p>
                  ) : (
                    discoverMatches.map((u) => {
                      const alreadyFriend = acceptedFriends.some((f) => f.uid === u.uid);
                      const alreadyPending = friendRequests.some(
                        (r) =>
                          r.status === 'pending' &&
                          ((r.fromUid === user.uid && r.toUid === u.uid) ||
                            (r.toUid === user.uid && r.fromUid === u.uid))
                      );
                      return (
                        <div
                          key={u.uid}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                u.online ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="font-semibold truncate text-slate-900 dark:text-white">{u.displayName}</p>
                              <p className="text-[10px] text-slate-500 truncate">@{u.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => openDirectChat(u.uid, u.displayName || 'Supporter')}
                              title="Direct message"
                              className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-[#E11D48] hover:text-white text-slate-700 dark:text-white font-semibold inline-flex items-center gap-1 transition"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </button>
                            {!alreadyFriend && !alreadyPending && (
                              <button
                                onClick={() => sendFriendRequest(u)}
                                className="px-2.5 py-1 rounded-lg bg-[#E11D48] text-white font-bold inline-flex items-center gap-1 hover:bg-[#BE123C]"
                              >
                                <UserPlus className="w-3 h-3" /> Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* STREAKS LEADERBOARD TAB */}
            {sideTab === 'streaks' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                  <p className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Flame className="w-4 h-4" />
                    STR Streaks Leaderboard
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Streaks grow +1 per day only when both friends genuinely message each other.
                  </p>
                </div>

                {streaks.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No active friend streaks yet. Message a friend and have them reply today to ignite Day 1!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {streaks.map((s, idx) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold truncate">
                            #{idx + 1} {s.nameA} & {s.nameB}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Best: {s.bestCount}d {s.badges?.length ? `· ${s.badges[s.badges.length - 1]}` : ''}
                          </p>
                        </div>
                        <span className="font-mono-tabular font-black text-amber-400 text-sm shrink-0">
                          🔥 {s.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main Chat Thread */}
        <section
          className={`relative lg:col-span-8 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden transition-colors ${activeBgClass}`}
        >
          {/* Goal Celebration Flash */}
          {goalBlast && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#E11D48]/15 backdrop-blur-[1px] animate-pulse">
              <div className="px-6 py-3 rounded-2xl bg-[#07090F]/95 border-2 border-[#E11D48] text-white font-display text-2xl font-black shadow-2xl">
                ⚽🔥 <span className="text-[#E11D48]">GOAL</span> CELEBRATION!
              </div>
            </div>
          )}

          {!activeRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
              <Users className="w-8 h-8 opacity-60 text-[#E11D48]" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Select a club channel or friend chat to start messaging
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 bg-white/80 dark:bg-[#0F1219]/90 backdrop-blur-md">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white truncate">
                      {activeRoom.name}
                    </h2>
                    {activeDmFriend && activeDmFriend.streakCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[11px] font-mono-tabular font-bold text-amber-400 shrink-0">
                        🔥 {activeDmFriend.streakCount}d
                      </span>
                    )}
                    {activeRoom.type === 'group' && (
                      <button
                        onClick={() => {
                          setEditingGroup((v) => !v);
                          setEditGroupName(activeRoom.name || '');
                        }}
                        title="Edit group name"
                        className="text-slate-400 hover:text-[#E11D48]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {Object.values(typingUsers).length > 0
                      ? `${Object.values(typingUsers).join(', ')} typing...`
                      : activeDmPeerProfile
                      ? `${activeDmPeerProfile.online ? '🟢 Online' : '⚫ Offline'} · Direct Message`
                      : `${activeRoom.type.toUpperCase()} · ${activeRoom.clubTag || 'Active room'}`}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {activeDmPeerUid && (
                    <>
                      <button
                        onClick={() => startCall(activeDmPeerUid, activeDmPeerName, false)}
                        title="Voice call"
                        className="p-2 rounded-xl bg-slate-100 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs hover:border-[#E11D48] text-[#E11D48]"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startCall(activeDmPeerUid, activeDmPeerName, true)}
                        title="Video call"
                        className="p-2 rounded-xl bg-slate-100 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs hover:border-[#E11D48] text-[#E11D48]"
                      >
                        <Video className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setInviteFriendTarget({ uid: activeDmPeerUid, name: activeDmPeerName })}
                        title="Challenge to mini-game"
                        className="p-2 rounded-xl bg-slate-100 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs hover:border-[#E11D48]"
                      >
                        <Gamepad2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowMsgSearch((v) => !v)}
                    title="Search messages"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs hover:border-[#E11D48]"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowAttachDrawer((p) => (p === 'bg' ? 'none' : 'bg'))}
                    title="Chat background theme"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs hover:border-[#E11D48]"
                  >
                    <Palette className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {editingGroup && activeRoom.type === 'group' && (
                <form
                  onSubmit={saveGroupMetadata}
                  className="px-4 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#07090F] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    placeholder="Rename group..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 text-xs"
                  />
                  <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#E11D48] text-white text-xs font-bold">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingGroup(false)} className="text-xs text-slate-400">
                    Cancel
                  </button>
                </form>
              )}

              {/* Message Search Bar */}
              {showMsgSearch && (
                <div className="px-4 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#07090F] flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    placeholder="Search messages inside this chat..."
                    className="flex-1 bg-transparent text-xs focus:outline-none"
                  />
                  {msgSearch && (
                    <button onClick={() => setMsgSearch('')} className="text-xs text-slate-400">
                      Clear
                    </button>
                  )}
                </div>
              )}

              {/* Pinned Messages Banner */}
              {pinnedMessages.length > 0 && (
                <div className="px-4 py-2 border-b border-slate-200 dark:border-white/10 bg-[#E11D48]/10 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Pin className="w-3.5 h-3.5 text-[#E11D48] shrink-0" />
                    <span className="font-bold truncate">
                      Pinned ({pinnedMessages.length}): {pinnedMessages[pinnedMessages.length - 1].text}
                    </span>
                  </div>
                </div>
              )}

              {/* Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[420px]">
                {visibleMessages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-500">
                    No messages here yet. Break the ice and send the first kickoff message!
                  </div>
                ) : (
                  visibleMessages.map((m) => {
                    const isMine = m.senderId === user.uid;
                    const repliedMsg = m.replyToId ? messages.find((x) => x.id === m.replyToId) : null;
                    const cardObj =
                      m.mediaType === 'card' && m.mediaData
                        ? PLAYER_CARDS_CATALOG.find((c) => c.id === m.mediaData)
                        : null;
                    const stickerObj =
                      m.mediaType === 'sticker' && m.mediaData
                        ? ANIMATED_FOOTBALL_STICKERS.find((s) => s.id === m.mediaData)
                        : null;
                    let parsedMeta: any = null;
                    if (m.metadata) {
                      try {
                        parsedMeta = JSON.parse(m.metadata);
                      } catch {
                        parsedMeta = null;
                      }
                    }
                    const seenByOthers = (m.readBy || []).some((id: string) => id !== m.senderId);

                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-md rounded-2xl px-4 py-2.5 text-xs space-y-1.5 shadow-sm ${
                            isMine
                              ? 'bg-[#E11D48] text-white'
                              : 'bg-slate-100 dark:bg-[#07090F]/95 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {/* Message Meta Header & Actions */}
                          <div className="flex items-center justify-between gap-4 font-bold text-[11px] opacity-90">
                            <span className="flex items-center gap-1">
                              {m.senderName}
                              {m.pinned && <Pin className="w-3 h-3" />}
                            </span>
                            {!m.deleted && (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => setReplyTo(m)} title="Reply">
                                  <Reply className="w-3 h-3" />
                                </button>
                                <button onClick={() => togglePinMessage(m)} title="Pin/Unpin">
                                  <Pin className="w-3 h-3" />
                                </button>
                                {QUICK_REACTIONS.map((em) => (
                                  <button key={em} onClick={() => reactToMessage(m, em)} title={`React ${em}`}>
                                    {em}
                                  </button>
                                ))}
                                {isMine ? (
                                  <>
                                    {m.mediaType === 'text' && (
                                      <button
                                        onClick={() => {
                                          setEditingMsgId(m.id);
                                          setEditMsgText(m.text || '');
                                        }}
                                        title="Edit"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                    )}
                                    <button onClick={() => deleteOwnMessage(m.id)} title="Delete">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => reportItem('message', m.id)} title="Report">
                                      <Flag className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => blockUser(m.senderId)} title="Block user">
                                      <Ban className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Reply Quote */}
                          {repliedMsg && !m.deleted && (
                            <div className="px-2.5 py-1 rounded-lg bg-black/20 text-[11px] border-l-2 border-white/70 truncate">
                              ↩ {repliedMsg.senderName}: {repliedMsg.text}
                            </div>
                          )}

                          {/* Media Payloads */}
                          {!m.deleted && m.mediaType === 'image' && m.mediaData && (
                            <img src={m.mediaData} alt="Shared attachment" className="max-h-48 rounded-xl object-cover" />
                          )}
                          {!m.deleted && m.mediaType === 'video' && m.mediaData && (
                            <video src={m.mediaData} controls className="max-h-48 rounded-xl" />
                          )}
                          {!m.deleted && m.mediaType === 'voice' && m.mediaData && (
                            <audio src={m.mediaData} controls className="w-56 h-8" />
                          )}
                          {!m.deleted && cardObj && (
                            <div className="pt-1">
                              <PlayerCardVisual card={cardObj} compact />
                            </div>
                          )}
                          {!m.deleted && stickerObj && (
                            <div
                              className={`rounded-2xl p-4 bg-gradient-to-br ${stickerObj.bg} text-white text-center space-y-1`}
                            >
                              <div className={`text-3xl ${stickerObj.anim}`}>{stickerObj.emoji}</div>
                              <div className="font-display font-black text-sm tracking-wide">
                                {stickerObj.text}
                              </div>
                            </div>
                          )}
                          {!m.deleted && m.mediaType === 'match' && parsedMeta && (
                            <button
                              onClick={() =>
                                setSelectedMatchForDetail({
                                  leagueId: parsedMeta.leagueId,
                                  eventId: parsedMeta.id,
                                })
                              }
                              className="w-full text-left p-3 rounded-xl bg-black/20 hover:bg-black/30 transition space-y-1"
                            >
                              <p className="text-[10px] font-bold uppercase opacity-80">{parsedMeta.leagueName}</p>
                              <p className="font-bold text-xs">
                                {parsedMeta.homeName} {parsedMeta.homeScore ?? '-'} : {parsedMeta.awayScore ?? '-'} {parsedMeta.awayName}
                              </p>
                              <p className="text-[10px] underline">Open Match Details →</p>
                            </button>
                          )}
                          {!m.deleted && m.mediaType === 'news' && parsedMeta && (
                            <a
                              href={parsedMeta.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-3 rounded-xl bg-black/20 hover:bg-black/30 transition space-y-1"
                            >
                              <p className="text-[10px] font-bold uppercase opacity-80">{parsedMeta.source}</p>
                              <p className="font-bold text-xs">{parsedMeta.title}</p>
                            </a>
                          )}
                          {!m.deleted && m.mediaType === 'invite' && parsedMeta && (
                            <button
                              onClick={() => {
                                setPendingChallengeId(parsedMeta.challengeId);
                                setActiveTab('games');
                              }}
                              className="w-full text-left p-3 rounded-xl bg-black/20 hover:bg-black/30 transition flex items-center justify-between gap-2"
                            >
                              <span className="font-bold text-xs">Accept {parsedMeta.gameType} Challenge</span>
                              <Gamepad2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Editing UI or Text */}
                          {editingMsgId === m.id ? (
                            <div className="flex gap-1.5 pt-1">
                              <input
                                type="text"
                                value={editMsgText}
                                onChange={(e) => setEditMsgText(e.target.value)}
                                className="flex-1 px-2.5 py-1 rounded-lg bg-white text-slate-900 text-xs"
                              />
                              <button
                                onClick={() => saveEditMessage(m.id)}
                                className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingMsgId(null)}
                                className="px-2 py-1 rounded-lg bg-black/20 text-[11px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            m.text && (
                              <p className={`text-sm leading-relaxed ${m.deleted ? 'italic opacity-65' : ''}`}>
                                {m.text}
                              </p>
                            )
                          )}

                          {/* Reactions + Edited + Read Receipt */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px]">
                            <div className="flex flex-wrap gap-1.5">
                              {m.reactions &&
                                Object.entries(m.reactions).map(([em, cnt]) => (
                                  <button
                                    key={em}
                                    onClick={() => reactToMessage(m, em)}
                                    className="px-1.5 py-0.5 rounded-md bg-black/20 hover:bg-black/30"
                                  >
                                    {em} {String(cnt)}
                                  </button>
                                ))}
                            </div>
                            {isMine && (
                              <span className="inline-flex items-center gap-1 opacity-85 text-[10px]">
                                {m.editedAt && !m.deleted && <span>(edited)</span>}
                                {seenByOthers ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={threadBottomRef} />
              </div>

              {/* Drawers: Emoji & Stickers OR Card/Match/News/Bg */}
              {showEmojiDrawer && (
                <div className="p-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#07090F] space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {CHAT_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setMsgText((prev) => `${prev}${em}`)}
                        className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-lg"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                      Animated Football Stickers
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {ANIMATED_FOOTBALL_STICKERS.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() =>
                            sendMessage(undefined, {
                              text: st.label,
                              mediaType: 'sticker',
                              mediaData: st.id,
                            })
                          }
                          className={`p-2 rounded-xl bg-gradient-to-br ${st.bg} text-white text-center text-[10px] font-bold`}
                        >
                          <div className="text-lg">{st.emoji}</div>
                          {st.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {[
                        '⚽ GOOOAL!',
                        '🏆 UCL Night!',
                        '🔥 Match Winner!',
                        '🇱🇧 Cedars Pride!',
                        '⚪ Hala Madrid!',
                        '🔴 YNWA!',
                      ].map((clubReact) => (
                        <button
                          key={clubReact}
                          type="button"
                          onClick={() =>
                            sendMessage(undefined, {
                              text: clubReact,
                              mediaType: 'text',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 hover:border-[#E11D48] text-[11px] font-semibold"
                        >
                          {clubReact}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {showAttachDrawer === 'card' && (
                <div className="p-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#07090F] space-y-2 max-h-52 overflow-y-auto">
                  <p className="text-[11px] font-bold text-[#E11D48]">Send a STR Player Card to Chat</p>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {PLAYER_CARDS_CATALOG.slice(0, 12).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          sendMessage(undefined, {
                            text: `Shared Player Card: ${c.name} (${c.overall} OVR ${c.rarity})`,
                            mediaType: 'card',
                            mediaData: c.id,
                          })
                        }
                        className="p-2 rounded-xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 hover:border-[#E11D48] text-left text-xs"
                      >
                        <p className="font-bold truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {c.overall} OVR · {c.rarity}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showAttachDrawer === 'match' && (
                <div className="p-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#07090F] space-y-2 max-h-52 overflow-y-auto">
                  <p className="text-[11px] font-bold text-[#E11D48]">Share a Real Match Fixture</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {liveMatchesCache.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          sendMessage(undefined, {
                            text: `${m.home.shortName} vs ${m.away.shortName} (${m.leagueName})`,
                            mediaType: 'match',
                            metadata: JSON.stringify({
                              id: m.id,
                              leagueId: m.leagueId,
                              leagueName: m.leagueName,
                              homeName: m.home.shortName,
                              awayName: m.away.shortName,
                              homeScore: m.home.score,
                              awayScore: m.away.score,
                            }),
                          })
                        }
                        className="p-2 rounded-xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 hover:border-[#E11D48] text-left text-xs"
                      >
                        <p className="font-bold truncate">
                          {m.home.shortName} {m.home.score ?? '-'} : {m.away.score ?? '-'} {m.away.shortName}
                        </p>
                        <p className="text-[10px] text-slate-500">{m.leagueName}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showAttachDrawer === 'news' && (
                <div className="p-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#07090F] space-y-2 max-h-52 overflow-y-auto">
                  <p className="text-[11px] font-bold text-[#E11D48]">Share Football News Article</p>
                  <div className="space-y-1.5">
                    {liveNewsCache.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          sendMessage(undefined, {
                            text: a.title,
                            mediaType: 'news',
                            metadata: JSON.stringify({ title: a.title, url: a.url, source: a.source }),
                          })
                        }
                        className="w-full p-2 rounded-xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 hover:border-[#E11D48] text-left text-xs truncate"
                      >
                        {a.title} ({a.source})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showAttachDrawer === 'bg' && (
                <div className="p-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#07090F] flex flex-wrap gap-2">
                  {Object.entries(CHAT_BACKGROUNDS).map(([k, bg]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => updateRoomBackground(k)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                        activeRoom.backgroundTheme === k
                          ? 'bg-[#E11D48] text-white border-[#E11D48]'
                          : 'bg-white dark:bg-[#0F1219] border-slate-200 dark:border-white/10'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              )}

              {(replyTo || pendingMedia) && (
                <div className="px-4 py-2 bg-slate-50 dark:bg-[#07090F] border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                  <span className="truncate">
                    {replyTo
                      ? `Replying to ${replyTo.senderName}: ${replyTo.text}`
                      : `Attached ${pendingMedia?.type}`}
                  </span>
                  <button
                    onClick={() => {
                      setReplyTo(null);
                      setPendingMedia(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Message Composer */}
              <form
                onSubmit={(e) => sendMessage(e)}
                className="p-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#07090F] flex flex-wrap items-center gap-1.5"
              >
                <label
                  title="Share photo or clip"
                  className="p-2 rounded-xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 cursor-pointer hover:border-[#E11D48]"
                >
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  <input type="file" accept="image/*,video/*" onChange={handleFileAttach} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={toggleVoiceRecord}
                  title="Record voice note"
                  className={`p-2 rounded-xl border ${
                    recording
                      ? 'bg-[#E11D48] text-white border-[#E11D48]'
                      : 'bg-white dark:bg-[#0F1219] border-slate-200 dark:border-white/10 text-slate-500'
                  }`}
                >
                  {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmojiDrawer((v) => !v)}
                  title="Emojis & animated stickers"
                  className="p-2 rounded-xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 text-slate-500 hover:border-[#E11D48]"
                >
                  <Smile className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowAttachDrawer((p) => (p === 'card' ? 'none' : 'card'))}
                  title="Send Player Card"
                  className="p-2 rounded-xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 text-slate-500 hover:border-[#E11D48]"
                >
                  <Layers className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={openShareMatchDrawer}
                  title="Share Football Match"
                  className="p-2 rounded-xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 text-slate-500 hover:border-[#E11D48]"
                >
                  <Trophy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={openShareNewsDrawer}
                  title="Share Football News"
                  className="p-2 rounded-xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 text-slate-500 hover:border-[#E11D48]"
                >
                  <Newspaper className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={msgText}
                  onChange={(e) => {
                    setMsgText(e.target.value);
                    safeWsSend({
                      type: 'typing',
                      roomId: activeRoom.id,
                      isTyping: e.target.value.length > 0,
                    });
                  }}
                  placeholder="Write a message..."
                  className="flex-1 min-w-[140px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:border-[#E11D48]"
                />
                <button
                  type="submit"
                  disabled={sending || (!msgText.trim() && !pendingMedia)}
                  className="px-4 py-2 rounded-xl bg-[#E11D48] text-white font-bold text-xs inline-flex items-center gap-1 hover:bg-[#BE123C] disabled:opacity-50 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Friend Profile Modal */}
      {friendProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                {friendProfileModal.name}
              </h3>
              <button onClick={() => setFriendProfileModal(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              @{friendProfileModal.username || 'supporter'} ·{' '}
              {friendProfileModal.online ? 'Online now' : 'Recently active'} · 🔥{' '}
              {friendProfileModal.streakCount}d Streak
            </p>
            {friendProfileModal.bio && <p className="text-xs text-slate-300">{friendProfileModal.bio}</p>}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Favorite Clubs</p>
              <div className="flex flex-wrap gap-1.5">
                {(friendProfileModal.favoriteTeams || ['No clubs listed']).map((c: string) => (
                  <span
                    key={c}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#07090F] text-xs font-semibold"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  const t = friendProfileModal;
                  setFriendProfileModal(null);
                  openDirectChat(t.uid, t.name);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#E11D48] text-white font-bold text-xs"
              >
                Open DM Chat
              </button>
              <button
                onClick={() => {
                  const t = friendProfileModal;
                  setFriendProfileModal(null);
                  setInviteFriendTarget({ uid: t.uid, name: t.name });
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 font-bold text-xs"
              >
                Invite to Game
              </button>
              <button
                onClick={() => {
                  blockUser(friendProfileModal.uid);
                  setFriendProfileModal(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600/20 text-rose-400 text-xs font-bold"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Friend to Challenge Modal */}
      {inviteFriendTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">
                Challenge {inviteFriendTarget.name}
              </h3>
              <button onClick={() => setInviteFriendTarget(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'penalty' as const, label: 'Penalty Shootout' },
                { id: 'free_kick' as const, label: 'Free Kick Challenge' },
                { id: 'quiz' as const, label: 'Who Am I? Quiz' },
                { id: 'higher_lower' as const, label: 'Higher or Lower' },
                { id: 'card_battle' as const, label: 'Card Battle Duel' },
                { id: 'trivia_blitz' as const, label: 'Trivia Blitz' },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => sendGameInvite(inviteFriendTarget.uid, inviteFriendTarget.name, g.id)}
                  className="p-3 rounded-xl bg-[#E11D48] text-white font-bold text-xs hover:bg-[#BE123C] transition"
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Streak Rules Modal */}
      {showStreakRules && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold flex items-center gap-2 text-amber-400">
                <Flame className="w-6 h-6" />
                STR Streaks Fair Rules
              </h3>
              <button onClick={() => setShowStreakRules(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <li>• Streaks start and advance ONLY when BOTH friends send a real message on the same UTC day.</li>
              <li>• One-sided spam never inflates a streak — your friend must reply for the day to count.</li>
              <li>• Milestones unlock special badges at 3, 7, 14, 30, and 100 consecutive days.</li>
              <li>• Missing a day resets the active streak counter to 0 while preserving your all-time Best Streak record.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Active WebRTC Call Modal */}
      {callState?.active && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#0F1219] border border-white/10 p-6 text-white space-y-4 text-center">
            <h3 className="font-display text-2xl font-bold">{callState.peerName}</h3>
            <p className="text-xs text-[#E11D48] font-bold">{callState.status}</p>
            {callState.video && (
              <div className="grid grid-cols-2 gap-2">
                <video ref={localVideoRef} autoPlay muted playsInline className="rounded-xl bg-black h-40 w-full object-cover" />
                <video ref={remoteVideoRef} autoPlay playsInline className="rounded-xl bg-black h-40 w-full object-cover" />
              </div>
            )}
            <button
              onClick={() => endCall(true)}
              className="mx-auto inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E11D48] text-white font-bold text-sm hover:bg-[#BE123C]"
            >
              <PhoneOff className="w-4 h-4" />
              End Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FriendRow({
  fr,
  onChat,
  onOpenProfile,
  onCall,
  onInvite,
  onRemove,
}: {
  fr: any;
  onChat: () => void;
  onOpenProfile: () => void;
  onCall: (video: boolean) => void;
  onInvite: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
      <button onClick={onOpenProfile} className="min-w-0 text-left flex items-center gap-2 flex-1">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            fr.online ? 'bg-emerald-400' : 'bg-slate-500'
          }`}
        />
        <div className="min-w-0">
          <p className="font-semibold truncate flex items-center gap-1.5 text-slate-900 dark:text-white">
            {fr.name}
            {fr.streakCount > 0 && (
              <span className="text-[10px] font-mono-tabular text-amber-400">🔥 {fr.streakCount}</span>
            )}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onChat}
          title="Direct message"
          className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:text-[#E11D48]"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onInvite}
          title="Invite to mini-game"
          className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:text-[#E11D48]"
        >
          <Gamepad2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onCall(false)}
          title="Voice call"
          className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:text-[#E11D48]"
        >
          <Phone className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onCall(true)}
          title="Video call"
          className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:text-[#E11D48]"
        >
          <Video className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRemove}
          title="Remove friend"
          className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:text-rose-400"
        >
          <UserMinus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

void Info;
void Sparkles;
void UserCheck;
