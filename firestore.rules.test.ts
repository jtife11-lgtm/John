/**
 * Firestore Security Rules Test Suite (Phase 0 TDD)
 * Validates that the Dirty Dozen attack payloads documented in security_spec.md
 * are rejected while legitimate owner/verified operations succeed.
 */
export const dirtyDozenPayloads = [
  { name: 'Shadow Field Injection on Profile', path: 'users/u1', payload: { uid: 'u1', username: 'ali', displayName: 'Ali', points: 0, isAdmin: true } },
  { name: 'Email Spoofing Admin Bypass', path: 'reports/r1', auth: { uid: 'attacker', email: 'johnnwaccbmw@gmail.com', email_verified: false } },
  { name: 'PII Leak Cross-Read', path: 'users/victim/private/info', auth: { uid: 'attacker' } },
  { name: 'UID Spoofing in Chat Message', path: 'chats/c1/messages/m1', payload: { senderId: 'otherUser' } },
  { name: '1MB String Poisoning in Bio', path: 'users/u1', payload: { bio: 'A'.repeat(5000) } },
  { name: 'Bad Path ID Poisoning', path: 'polls/bad$id', payload: {} },
  { name: 'Double Vote Injection', path: 'polls/p1/votes/someoneElseUid', auth: { uid: 'u1' } },
  { name: 'Out-of-Band Poll Vote Manipulation', path: 'polls/p1', payload: { totalVotes: 999 } },
  { name: 'Unauthorized Private Chat Read', path: 'chats/dm_ab/messages', auth: { uid: 'outsider' } },
  { name: 'Self-Privilege Escalation', path: 'admins/attacker', payload: { uid: 'attacker' } },
  { name: 'Terminal State Tampering', path: 'reports/r1', payload: { status: 'resolved' } },
  { name: 'Client Timestamp Forgery', path: 'predictions/p1', payload: { createdAt: '2020-01-01' } },
];
