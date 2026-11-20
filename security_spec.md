# Security Specification — 오피스 시설매니저 (Office Facility Manager)

## 1. Data Invariants & Master Source of Truth

1. **Zero Self-Signup & RBAC Authority**:
   - The authoritative admin registry is `/admins/{adminUid}` plus the bootstrapped administrator email (`bhkang1030@gmail.com` with `email_verified == true`).
   - Regular employees exist ONLY when created by an admin in `/users/{userId}` (or via claiming a pre-authorized `/invited_users/{inviteId}` document whose verified email matches).
   - No user may self-assign `role: "admin"` or modify their own `role` or `status`.
   - Plaintext passwords are NEVER stored in Firestore.
2. **PII Isolation**:
   - `/users/{userId}` stores `email` and `login_id`. Only the account owner (`request.auth.uid == userId`) or an administrator (`isAdmin()`) may `get` a user document. Only `isAdmin()` may `list` `/users`.
3. **Database-Level Atomic Double-Booking Prevention**:
   - Every booked 1-hour room slot creates a unique deterministic document `/room_slots/{roomId}_{YYYY-MM-DD}_{HH}` inside a Firestore transaction alongside `/room_reservations/{reservationId}`.
   - `/room_slots` forbids `update` (`allow update: if false;`), and `create` requires `existsAfter(/databases/$(database)/documents/room_reservations/$(incoming().reservation_id))`.
   - Meeting room reservations enforce `9 <= start_hour < end_hour <= 18` and `end_hour - start_hour <= 4` directly in Firestore rules.
4. **Equipment Loan State Machine & Single Active Loan Invariant**:
   - Employees may only create loans in `approval_status: "pending"` for equipment whose `status == "available"`.
   - Only `isAdmin()` may transition `pending -> approved` (atomically verifying `getAfter(equipment).data.status == "rented"`), `pending -> rejected`, or `approved -> returned` (atomically verifying `getAfter(equipment).data.status == "available"`).
   - Terminal states (`rejected`, `returned`, `cancelled`) are locked against further updates.
5. **Immutable Audit Trail & Server Timestamps**:
   - `/activity_logs/{logId}` is append-only (`update` and `delete` denied).
   - All `created_at` and `updated_at` fields must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Adversarial Payload / Action | Expected Result |
|---|---|---|---|---|
| 1 | **Role Self-Escalation (Create)** | `/users/emp1` | Employee creates `/users/emp1` with `{ role: "admin", status: "active", ... }` without admin/invite | `PERMISSION_DENIED` |
| 2 | **Role Escalation (Update)** | `/users/emp1` | Employee updates own `/users/emp1` changing `role` to `"admin"` | `PERMISSION_DENIED` |
| 3 | **Email Spoofing (Unverified Admin)** | `/rooms/room-01` | Attacker with `email: "bhkang1030@gmail.com"` and `email_verified: false` writes room | `PERMISSION_DENIED` |
| 4 | **PII Blanket Read** | `/users/emp2` | Employee `emp1` attempts `get` on `/users/emp2` or `list` on `/users` | `PERMISSION_DENIED` |
| 5 | **Shadow Field Injection** | `/room_reservations/res1` | Employee creates reservation with extra ghost field `isVerified: true` | `PERMISSION_DENIED` |
| 6 | **Identity Spoofing on Booking** | `/room_reservations/res1` | Employee `emp1` creates reservation with `user_id: "emp2"` | `PERMISSION_DENIED` |
| 7 | **Policy Bypass (5-Hour Booking)** | `/room_reservations/res1` | Employee books `start_hour: 9, end_hour: 14` (5 hours > 4h max) | `PERMISSION_DENIED` |
| 8 | **Slot Overwrite Double-Booking** | `/room_slots/room-01_2026-11-23_09` | Employee attempts `update` on an already booked room slot | `PERMISSION_DENIED` |
| 9 | **Employee Self-Approving Loan** | `/equipment_loans/loan1` | Employee creates loan directly with `approval_status: "approved"` or updates `pending -> approved` | `PERMISSION_DENIED` |
| 10 | **Terminal State Mutation** | `/room_reservations/res_cancelled` | Employee updates a `cancelled` reservation back to `confirmed` | `PERMISSION_DENIED` |
| 11 | **Resource Poisoning (Oversized ID / String)** | `/room_reservations/{200-char-id}` | Attacker passes invalid chars or 1KB string in `purpose` or document ID | `PERMISSION_DENIED` |
| 12 | **Audit Log Tampering / Client Timestamp Spoofing** | `/activity_logs/log1` | User attempts `update`/`delete` on log or writes fake client timestamp for `created_at` | `PERMISSION_DENIED` |
