import React, { useEffect, useState } from 'react';
import { Bell, Check, LogOut, Settings, Shield, Trash2, User } from 'lucide-react';
import { deleteUser, updatePassword } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useApp } from '../context/AppContext';

export function ProfileScreen() {
  const {
    user,
    userProfile,
    userPrivate,
    isAdmin,
    notifications,
    markNotificationRead,
    signOut,
    setShowAuthModal,
    setAuthModalMode,
    setShowOnboarding,
    setActiveTab,
    pushToast,
    refreshAuthUser,
    resendVerification,
  } = useApp();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBio(userProfile.bio || '');
    }
  }, [userProfile]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto rounded-3xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-8 text-center space-y-4">
        <User className="w-10 h-10 text-[#E11D48] mx-auto" />
        <h1 className="font-display text-3xl font-bold">Supporter Profile & Alerts</h1>
        <p className="text-sm text-slate-500">
          You are currently browsing as a Guest. Create a free account or sign in to save your profile, manage notification preferences, add friends, and unlock cloud sync.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              setAuthModalMode('signin');
              setShowAuthModal(true);
            }}
            className="px-6 py-2.5 rounded-xl bg-[#E11D48] text-white font-bold text-sm"
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setAuthModalMode('signup');
              setShowAuthModal(true);
            }}
            className="px-6 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold"
          >
            Create Account
          </button>
          <button
            onClick={() => setShowOnboarding(true)}
            className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-[#07090F] text-sm font-semibold"
          >
            Edit Guest Clubs
          </button>
        </div>
      </div>
    );
  }

  const updateProfileInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim().slice(0, 64) || 'Supporter',
        bio: bio.trim().slice(0, 280),
        updatedAt: serverTimestamp(),
      });
      pushToast('Profile updated!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleNotifPref = async (key: string, val: boolean) => {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'private', 'info'), {
        [key]: val,
        updatedAt: serverTimestamp(),
      });
      pushToast('Notification preference updated', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/private/info`);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      pushToast('New password must be at least 6 characters.', 'error');
      return;
    }
    try {
      await updatePassword(user, newPassword);
      setNewPassword('');
      pushToast('Password changed successfully!', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'Re-authenticate first to change password.', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'private', 'info')).catch(() => {});
      await deleteDoc(doc(db, 'users', user.uid)).catch(() => {});
      await deleteUser(user);
      pushToast('Account deleted.', 'info');
    } catch (err: any) {
      pushToast(err?.message || 'Sign out and sign back in recently before deleting account.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900 dark:text-white">
            {userProfile?.displayName || 'Your Profile'}
          </h1>
          <p className="text-xs text-slate-500">
            @{userProfile?.username} · {user.email}{' '}
            {user.emailVerified ? '(Verified)' : '(Unverified)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!user.emailVerified && (
            <>
              <button
                onClick={resendVerification}
                className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"
              >
                Resend Verification
              </button>
              <button
                onClick={refreshAuthUser}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                I Verified
              </button>
            </>
          )}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
            >
              <Shield className="w-4 h-4" />
              Admin Dashboard
            </button>
          )}
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:border-rose-500"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Edit Profile + Password */}
        <div className="lg:col-span-6 space-y-5">
          <form
            onSubmit={updateProfileInfo}
            className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#E11D48]" />
                Edit Supporter Profile
              </h2>
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="text-xs font-semibold text-[#E11D48] dark:text-[#E11D48] hover:underline"
              >
                Edit Favorite Teams & Leagues
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          <form
            onSubmit={handleChangePassword}
            className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-3"
          >
            <h2 className="font-display text-xl font-bold">Security & Account</h2>
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold"
              >
                Update Password
              </button>
            </div>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="inline-flex items-center gap-1.5 text-xs text-rose-500 font-semibold pt-2 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Account Permanently
            </button>
          </form>
        </div>

        {/* Notifications & Preferences */}
        <div className="lg:col-span-6 space-y-5">
          <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-3">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#E11D48]" />
              Personalized Notification Preferences
            </h2>
            <div className="grid sm:grid-cols-2 gap-2.5 text-xs">
              {[
                { key: 'notifGoals', label: 'Favorite Team Goals' },
                { key: 'notifKickoff', label: 'Match Starting Alerts' },
                { key: 'notifFinal', label: 'Final Match Results' },
                { key: 'notifRedCards', label: 'Red Cards & Key Events' },
                { key: 'notifNews', label: 'Breaking Football News' },
                { key: 'notifFriends', label: 'Friend Requests & Messages' },
                { key: 'notifGroups', label: 'Group Chat Alerts' },
                { key: 'notifQuiz', label: 'Daily Quiz Reminders' },
              ].map((pref) => {
                const enabled = Boolean((userPrivate as any)?.[pref.key] ?? true);
                return (
                  <button
                    key={pref.key}
                    onClick={() => toggleNotifPref(pref.key, !enabled)}
                    className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition ${
                      enabled
                        ? 'bg-[#E11D48]/10 border-[#E11D48] text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/10 text-slate-500'
                    }`}
                  >
                    <span>{pref.label}</span>
                    <span className="font-bold">{enabled ? 'ON' : 'OFF'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-3">
            <h2 className="font-display text-xl font-bold">Notifications Inbox</h2>
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500">No unread notifications yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map((n) => (
                  <div key={n.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold">{n.title}</p>
                      <p className="text-slate-500">{n.body}</p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => markNotificationRead(n.id)}
                        className="p-1.5 rounded-lg text-[#E11D48]"
                        title="Mark read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { user, isAdmin, pushToast } = useApp();
  const [reports, setReports] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [customNews, setCustomNews] = useState<any[]>([]);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsCategory, setNewsCategory] = useState('Breaking');

  useEffect(() => {
    if (!isAdmin) return;
    const unsubRep = onSnapshot(
      query(collection(db, 'reports'), orderBy('createdAt', 'desc')),
      (s) => setReports(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (s) => setUsersList(s.docs.map((d) => d.data())),
      () => {}
    );
    const unsubNews = onSnapshot(
      query(collection(db, 'customNews'), orderBy('createdAt', 'desc')),
      (s) => setCustomNews(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => {
      unsubRep();
      unsubUsers();
      unsubNews();
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center text-sm text-rose-500">
        Admin access restricted.
      </div>
    );
  }

  const publishEditorial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || newsTitle.trim().length < 3 || newsSummary.trim().length < 10) return;
    const id = `news_${Date.now()}`;
    await setDoc(doc(db, 'customNews', id), {
      title: newsTitle.trim().slice(0, 180),
      summary: newsSummary.trim().slice(0, 2000),
      category: newsCategory,
      authorId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewsTitle('');
    setNewsSummary('');
    pushToast('Editorial news published!', 'success');
  };

  const resolveReport = async (id: string, status: 'resolved' | 'dismissed') => {
    await updateDoc(doc(db, 'reports', id), {
      status,
      updatedAt: serverTimestamp(),
    });
    pushToast(`Report marked ${status}`, 'success');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-7 h-7 text-[#E11D48]" />
          STR SCORES Admin Console
        </h1>
        <p className="text-xs text-slate-500">
          Manage editorial football news, review moderation reports, and monitor supporter accounts.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <form
          onSubmit={publishEditorial}
          className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-3"
        >
          <h2 className="font-display text-xl font-bold">Publish Editorial News</h2>
          <input
            type="text"
            required
            value={newsTitle}
            onChange={(e) => setNewsTitle(e.target.value)}
            placeholder="Headline"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-sm"
          />
          <select
            value={newsCategory}
            onChange={(e) => setNewsCategory(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-sm"
          >
            {['Breaking', 'Transfers', 'Clubs', 'International', 'Lebanese', 'Gaming'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <textarea
            rows={4}
            required
            value={newsSummary}
            onChange={(e) => setNewsSummary(e.target.value)}
            placeholder="Article summary..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-sm"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
          >
            Publish to Newsroom
          </button>

          {customNews.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-2">
              {customNews.map((cn) => (
                <div key={cn.id} className="flex items-center justify-between text-xs">
                  <span className="truncate font-semibold">{cn.title}</span>
                  <button
                    type="button"
                    onClick={() => deleteDoc(doc(db, 'customNews', cn.id))}
                    className="text-rose-500 font-bold"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </form>

        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-3">
            <h2 className="font-display text-xl font-bold">Moderation Reports ({reports.length})</h2>
            {reports.length === 0 ? (
              <p className="text-xs text-slate-500">No active moderation reports.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold">
                        {rep.targetType}: {rep.targetId} ({rep.status})
                      </p>
                      <p className="text-slate-500">{rep.reason}</p>
                    </div>
                    {rep.status === 'open' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => resolveReport(rep.id, 'resolved')}
                          className="px-2.5 py-1 rounded bg-[#E11D48] text-white font-bold"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => resolveReport(rep.id, 'dismissed')}
                          className="px-2.5 py-1 rounded bg-slate-700 text-white"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-3">
            <h2 className="font-display text-xl font-bold">Supporter Accounts ({usersList.length})</h2>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {usersList.map((u) => (
                <div key={u.uid} className="py-2 flex items-center justify-between">
                  <span>
                    <strong>{u.displayName}</strong> (@{u.username})
                  </span>
                  <span className="font-mono-tabular text-[#E11D48]">{u.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
