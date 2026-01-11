# Comprehensive Test Plan

## Objective
Ensure robustness of the Engram application by implementing comprehensive test coverage for critical flows, specifically focusing on authentication, encryption consistency, and data persistence. This plan addresses the recent issue where inconsistent encryption keys caused data loss upon re-login.

## 1. Integration Tests: Auth & Encryption Consistency
**Location**: `packages/community/tests/integration/auth-encryption.test.ts`

### Test Case 1.1: Registration & Salt Persistence
- **Scenario**: User registers a new account.
- **Verification**:
    -   `authClient.register` is called.
    -   `crypto.generateSalt` is called.
    -   `authClient.updateUserMetadata` is called with the generated salt.
    -   `crypto.deriveKey` is called with the password and the generated salt.
    -   Master key is set in background service.

### Test Case 1.2: Login & Key Restoration (The Fix Verification)
- **Scenario**: Existing user logs in.
- **Setup**: User has a known salt stored in metadata.
- **Verification**:
    -   `authClient.login` returns user with metadata containing salt.
    -   `crypto.deriveKey` is called with the *same* salt from metadata (not a new random one).
    -   Derived master key matches the original key from registration.

### Test Case 1.3: End-to-End Encryption Loop
- **Scenario**: Register -> Save Memory -> Logout -> Login -> Read Memory.
- **Steps**:
    1.  **Register** User A.
    2.  **Save** a memory (Memory M) -> Encrypted with Key A.
    3.  **Logout** (Clear Key A from memory).
    4.  **Login** User A -> Derive Key A' (should equal Key A).
    5.  **Get Memories** -> Decrypt Memory M with Key A'.
- **Verification**: Decrypted text matches original text. Failure here indicates the "Encrypted" bug is present.

### Test Case 1.4: Google OAuth Flow
- **Scenario**: User logs in with Google.
- **Verification**:
    -   `authClient.loginWithGoogle` success.
    -   `crypto.generateEncryptionKey` is called (since no password).
    -   Key is persisted securely.

## 2. Unit Tests: Auth Client Metadata
**Location**: `packages/community/tests/unit/lib/auth-client.test.ts`

### Test Case 2.1: User Metadata Handling
-   Verify `.register()` returns `user_metadata`.
-   Verify `.login()` returns `user_metadata`.
-   Verify `.updateUserMetadata()` correctly calls Supabase `updateUser` endpoint.

## 3. End-to-End (E2E) Tests: Critical User Flows
**Location**: `packages/community/tests/e2e/user-flows.spec.ts` (using Playwright/Puppeteer if available, otherwise mocked E2E)

### Test Case 3.1: Full User Journey
-   **Step 1**: Open Extension.
-   **Step 2**: Sign up.
-   **Step 3**: Simulate receiving a message from Content Script.
-   **Step 4**: Verify memory appears in Side Panel.
-   **Step 5**: Logout.
-   **Step 6**: Login.
-   **Step 7**: Verify memory still appears and is readable (not "[ENCRYPTED]").

## Implementation Strategy
1.  **Create Integration Test File**: `packages/community/tests/integration/auth-encryption.test.ts`. This is the highest value/lowest cost step to verify the fix immediately.
2.  **Update Unit Tests**: Add metadata checks to `auth-client` tests.
3.  **Run Tests**: Execute `npm run test:integration` to validate.

## Execution Order
I will implement **Test Case 1.3 (End-to-End Encryption Loop)** immediately as an integration test, as this directly reproduces the bug you encountered and verifies the fix.
