# AUTHENTICATION.md — Authentication & Firebase Integration Guide

## 1. Overview

UniVote relies on **Firebase Authentication** for identity management. The client authenticates against Firebase to receive a JWT ID token, which is passed in the `Authorization` header to FastAPI for server-side verification.

## 2. Authentication Methods

1. **Email / Password**:
   - Client uses `createUserWithEmailAndPassword()` and `signInWithEmailAndPassword()`.
   - Requires email verification before accessing protected student/staff features.
2. **Google OAuth**:
   - Client triggers `signInWithPopup(auth, googleProvider)`.
   - Returns verified email and profile name directly from Google.
3. **Password Reset**:
   - Client triggers `sendPasswordResetEmail()` via Firebase.

## 3. Token Verification Pipeline

Every authenticated request sent from the frontend includes:
```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

FastAPI processes the token using dependencies defined in `backend/app/auth/dependencies.py`:

```mermaid
sequenceDiagram
    participant Client as Frontend Client
    participant Dep as get_verified_firebase_token()
    participant SDK as Firebase Admin SDK
    participant UserDep as get_current_user()
    participant DB as PostgreSQL

    Client->>Dep: Request + Bearer Token
    Dep->>SDK: verify_id_token(token)
    alt Invalid / Expired / Revoked
        SDK-->>Dep: Token Error
        Dep-->>Client: 401 Unauthorized
    else Valid Token
        SDK-->>Dep: Decoded Claims (uid, email)
        Dep->>UserDep: Pass Claims
        UserDep->>DB: Query User by firebase_uid
        alt User Not Found
            UserDep->>DB: Query User by email (Fallback link)
            alt Email Not Found
                UserDep-->>Client: 401 Unauthorized (Account Not Found)
            else Email Found
                UserDep->>DB: Update user.firebase_uid = token.uid
            end
        end
        UserDep->>UserDep: Check user.is_active
        alt is_active == False
            UserDep-->>Client: 403 Forbidden (Account Deactivated)
        else is_active == True
            UserDep-->>Client: Current User Object Injected into Endpoint
        end
    end
```

## 4. Account Synchronization (`POST /api/auth/sync`)

Immediately upon sign-in or registration, the frontend calls `POST /api/auth/sync`:
- Checks if a `User` record exists for the given `firebase_uid`.
- If missing, creates a new `User` entity with:
  - `role = UserRole.STUDENT`
  - `is_active = True`
  - `is_verified = False`
- Prevents role spoofing: registration inputs cannot supply a custom role.
