# Security Specification - Fidelité Imobiliária

## 1. Data Invariants
- **Identity Integrity:** A user cannot create a profile with a UID that does not match their own `request.auth.uid`, unless they are an Admin.
- **Relational Integrity:** Tasks and Processes MUST belong to a valid user. Document creation requires the `uid` field to match the authenticated user.
- **Access Revocation:** Users marked as `status == 'blocked'` or with `role == 'none'` must be instantly denied all access (read/write).
- **Immutable Fields:** Fields like `createdAt` and `uid` (for non-admins) must not change after creation.
- **Privilege Escalation Guard:** Non-admin users cannot change their `role` or `status`.

## 2. The "Dirty Dozen" Payloads (Attack Vectors)

| ID | Vector | Collection | Payload Description | Expected Result |
|----|--------|------------|---------------------|-----------------|
| V1 | Identity Spoofing | `/users` | Create profile with `uid: "victim_id"` while logged in as `attacker_id`. | `REJECTED` |
| V2 | Privilege Escalation| `/users` | Update own `role` from 'user' to 'admin'. | `REJECTED` |
| V3 | Status Bypass | `/users` | Update own `status` from 'blocked' to 'active'. | `REJECTED` |
| V4 | Resource Poisoning | `/tasks` | Create task with 1MB string in `title`. | `REJECTED` |
| V5 | Orphaned Write | `/tasks` | Create task with `uid` of another user. | `REJECTED` |
| V6 | Shadow Update | `/tasks` | Update task adding `bonus_field: "hidden_data"`. | `REJECTED` |
| V7 | Cross-User Peek | `/tasks` | `list` tasks where `uid != auth.uid`. | `REJECTED` |
| V8 | Admin Lockout | `/settings` | Non-admin attempts to update company logo. | `REJECTED` |
| V9 | Temporal Attack | `/tasks` | Set `createdAt` to a future date instead of `serverTimestamp()`. | `REJECTED` |
| V10| ID Injection | `/users` | Create doc with ID `../sneaky/path`. | `REJECTED` |
| V11| Schema Drift | `/tasks` | Update `priority` to `invalid_priority`. | `REJECTED` |
| V12| PII Leak | `/users` | Read `email` of another user without Admin rights. | `REJECTED` |

## 3. Test Runner (Mock Tests)
The following tests verify the rules against the "Dirty Dozen":

```typescript
// firestore.rules.test.ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

describe("Fidelité Imobiliária Security Audit", () => {
  it("V1: Should prevent identity spoofing", async () => {
     // Test logic here
  });
  
  it("V2: Should prevent self-promotion to admin", async () => {
     // Test logic here
  });
  // ... etc
});
```
