# FRONTEND.md — Frontend Architecture & Component Guide

## 1. Overview

The UniVote frontend is a responsive Single Page Application (SPA) developed with **React 19**, **TypeScript**, and **Vite**, using **React Router DOM v7** for routing and navigation.

## 2. Directory Structure

```
frontend/src/
├── assets/          # Static imagery (banner.jpg, hero.png, vite.svg)
├── auth/            # Authentication context and route guards
│   ├── AuthContext.tsx
│   └── ProtectedRoute.tsx
├── components/      # Shared presentation components
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Loader.tsx
│   ├── Loader.css
│   └── LoadingScreen.tsx
├── hooks/           # Custom React hooks
│   └── useAuth.ts
├── lib/             # Third-party integrations
│   └── firebase.ts
├── pages/           # Route-level page views
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── VerifyEmailPage.tsx
│   ├── DashboardPage.tsx
│   ├── RoleDashboardPage.tsx
│   ├── ProfilePage.tsx
│   ├── StudentManagementPage.tsx
│   ├── ElectionsPage.tsx
│   ├── ElectionWizardPage.tsx
│   ├── ElectionDetailPage.tsx
│   └── ApprovalsPage.tsx
├── services/        # Backend HTTP client
│   └── api.ts
├── App.tsx          # Router declaration and providers
├── index.css        # Global CSS styling
└── main.tsx         # Application entry point
```

## 3. State Management & Authentication Context

All user identity and session states are centralized in `AuthContext.tsx`.

### `AuthContext` Responsibilities:
- Listens to Firebase authentication state changes via `onAuthStateChanged()`.
- Automatically retrieves and caches Firebase ID tokens.
- Invokes `syncUser()` or `getMe()` against the backend to load the authoritative user profile (`UserProfile`).
- Tracks loading status (`loading`, `authenticated`, `unauthenticated`).
- Provides methods: `login()`, `loginWithGoogle()`, `register()`, `logout()`, `sendPasswordReset()`, `refreshProfile()`.

```typescript
export interface UserProfile {
  id: string;
  firebase_uid: string;
  student_id: string | null;
  full_name: string;
  email: string;
  role: "STUDENT" | "ELECTION_OFFICIAL" | "SUPER_ADMIN";
  is_active: boolean;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}
```

## 4. Route Protection (`ProtectedRoute.tsx`)

1. **`PublicOnlyRoute`**: Accessible only when unauthenticated. If the user is authenticated, redirects to the role dashboard (`/dashboard`, `/official/dashboard`, or `/admin/dashboard`).
2. **`ProtectedRoute`**: Requires an active Firebase user and, by default, verified email status (`user.emailVerified`).
3. **`RoleProtectedRoute`**: Requires both authentication and an active user profile matching the allowed roles list:
   ```tsx
   <RoleProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
     <RoleDashboardPage role="SUPER_ADMIN" />
   </RoleProtectedRoute>
   ```

## 5. Key Pages & Features

- **`LoginPage.tsx` / `RegisterPage.tsx`**: Clean, accessible forms with Google OAuth popup buttons.
- **`DashboardPage.tsx`**: Student portal showing verification banners, active election cards, and navigation.
- **`RoleDashboardPage.tsx`**: Multi-role operational hub with responsive sidebar navigation, metric stat cards, and dynamic view switching.
- **`StudentManagementPage.tsx`**: Roster management for staff, featuring real-time roster search, status filters, and the CSV/XLSX upload modal with preview.
- **`ElectionWizardPage.tsx`**: Multi-step election builder (General Info → Schedule & Rules → Contested Positions → Review & Submit).
- **`ApprovalsPage.tsx`**: Super Admin review queue showing pending elections with reviewer status and approval/rejection modals.

## 6. HTTP API Client (`api.ts`)

- Centralized in `frontend/src/services/api.ts`.
- Automatically retrieves valid tokens using `getIdToken(false)`.
- Injects `Authorization: Bearer <token>` on all requests.
- Applies a strict 15-second timeout (`withTimeout`) to prevent hanging UI states.
- Normalizes server error responses into typed `ApiError` objects.
