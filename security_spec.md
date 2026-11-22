# STR SCORES Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **PII Isolation**: Emails, blocked UIDs, and private preferences live exclusively in `/users/{userId}/private/{docId}` and are readable/writable only by the owning user or an admin. Public profiles in `/users/{userId}` never store emails or private tokens.
2. **Verified Write Gate**: Standard writes require `request.auth != null && request.auth.token.email_verified == true`. Admin checks require either `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` or verified primary admin email (`johnnwaccbmw@gmail.com` with `email_verified == true`).
3. **Immutable Ownership & Timestamps**: `createdAt`, `uid`, `authorId`, `senderId`, `reporterId`, and `userId` cannot be reassigned after creation. `createdAt` must equal `request.time` on creation, and `updatedAt` must equal `request.time` on mutation.
4. **Duplicate Vote Prevention**: Poll votes live at `/polls/{pollId}/votes/{voterId}` where `voterId == request.auth.uid`, and poll count updates must execute atomically with vote creation via `existsAfter` / `getAfter`.
5. **Bounded Arrays & String Lengths**: Every string enforces `.size()` bounds; every array enforces `.size() <= MAX` and validates element types.
6. **Master Gate Chat Isolation**: Direct and group chat messages under `/chats/{chatId}/messages/{messageId}` fetch the parent `/chats/{chatId}` document and verify `request.auth.uid in parent.participantIds` (unless the parent is a public `channel`).
7. **Secure List Queries**: `friendRequests`, `notifications`, `savedArticles`, `predictions`, and `reports` enforce `resource.data` ownership predicates directly in `allow list`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. **Shadow Field Injection on Profile**: Creating `/users/u1` with `{ uid: "u1", username: "ali", displayName: "Ali", points: 0, isAdmin: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }` -> Rejected by `keys().hasOnly(...)`.
2. **Email Spoofing Admin Bypass**: Reading `/reports/r1` as `{ uid: "attacker", email: "johnnwaccbmw@gmail.com", email_verified: false }` -> Rejected by `email_verified == true`.
3. **PII Leak Cross-Read**: Reading `/users/victim/private/info` as authenticated user `attacker` -> Rejected by `isOwner(userId)`.
4. **UID Spoofing in Chat Message**: Creating `/chats/c1/messages/m1` with `senderId: "otherUser"` -> Rejected by `senderId == request.auth.uid`.
5. **1MB String Poisoning in Bio**: Updating `/users/u1` with `bio: "A".repeat(5000)` -> Rejected by `bio.size() <= 280`.
6. **Bad Path ID Poisoning**: Creating `/polls/bad$id` -> Rejected by `isValidId(pollId)`.
7. **Double Vote Injection**: Creating `/polls/p1/votes/someoneElseUid` as `u1` -> Rejected by `voterId == request.auth.uid`.
8. **Out-of-Band Poll Vote Manipulation**: Updating `/polls/p1` counts without creating `/polls/p1/votes/$(request.auth.uid)` -> Rejected by `existsAfter(...)`.
9. **Unauthorized Private Chat Read**: Listing `/chats/dm_ab/messages` where `request.auth.uid` is not in `participantIds` -> Rejected by Master Gate `get()`.
10. **Self-Privilege Escalation**: Creating `/admins/attacker` as non-admin -> Rejected by `allow create, update, delete: if isAdmin()`.
11. **Terminal State Tampering**: Updating a resolved `/reports/r1` (`status: 'resolved'`) as non-admin -> Rejected by terminal lock + `isAdmin()`.
12. **Client Timestamp Forgery**: Creating `/predictions/p1` with `createdAt: "2020-01-01"` -> Rejected by `createdAt == request.time`.
