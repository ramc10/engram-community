# Google OAuth Setup for Engram Extension

This guide walks you through setting up Google Sign-In for the Engram extension.

## Overview

Google OAuth requires configuration in two places:
1. **Google Cloud Console** - Create OAuth credentials
2. **Supabase Dashboard** - Enable Google provider

---

## Step 1: Get Chrome Extension Redirect URL

The Chrome extension needs a special redirect URL for OAuth. You can get this by running the extension in development mode.

### Option A: Get from Chrome DevTools Console

1. Load the extension in Chrome (`chrome://extensions`)
2. Open DevTools for the extension background service worker
3. Run this command in the console:
   ```javascript
   chrome.identity.getRedirectURL()
   ```
4. Copy the URL (it will look like: `https://<extension-id>.chromiumapp.org/`)

### Option B: Calculate from Extension ID

1. Find your extension ID in `chrome://extensions` (under Developer mode)
2. The redirect URL is: `https://<YOUR-EXTENSION-ID>.chromiumapp.org/`

**Example**: `https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/`

**Save this URL** - you'll need it for both Google Cloud Console and Supabase.

---

## Step 2: Create Google OAuth Credentials

### 2.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Name it something like "Engram Extension"

### 2.2 Enable Google+ API (Optional but Recommended)

1. In your Google Cloud project, go to **APIs & Services > Library**
2. Search for "Google+ API"
3. Click **Enable**

### 2.3 Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type (unless you have a Google Workspace)
3. Click **Create**

**Fill in the required fields**:
- **App name**: `Engram`
- **User support email**: Your email
- **Developer contact information**: Your email
- **Application home page** (optional): `https://github.com/yourusername/engram`
- **Privacy policy** (optional for now, required for production): Link to your privacy policy

4. Click **Save and Continue**
5. **Scopes**: Skip for now (default scopes are fine)
6. **Test users** (if in testing mode): Add your Google account email
7. Click **Save and Continue**

### 2.4 Create OAuth 2.0 Client ID

1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Choose **Application type**: **Chrome extension**
   - If you don't see "Chrome extension", choose "Web application" and we'll configure it manually

**For Chrome Extension type**:
- **Name**: `Engram Extension`
- **Application ID**: Paste your Chrome extension ID (just the ID, not the full URL)

**For Web Application type** (if Chrome extension isn't available):
- **Name**: `Engram Extension`
- **Authorized redirect URIs**: Add these two:
  - `https://<YOUR-EXTENSION-ID>.chromiumapp.org/`
  - `https://<YOUR-SUPABASE-PROJECT>.supabase.co/auth/v1/callback`

4. Click **Create**
5. **Copy the Client ID and Client Secret** - you'll need these for Supabase

**Important**: Save these credentials securely!
- Client ID: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
- Client Secret: `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 3: Configure Supabase

### 3.1 Enable Google Provider

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your Engram project
3. Navigate to **Authentication** > **Providers**
4. Find **Google** in the list and click to expand it

### 3.2 Configure Google Provider

**Enable Google**:
- Toggle **Enable Sign in with Google** to **ON**

**Add Credentials**:
- **Google Client ID**: Paste the Client ID from Google Cloud Console
- **Google Client Secret**: Paste the Client Secret from Google Cloud Console

**Configure Redirect URL** (Important!):
- The redirect URL is shown in Supabase: `https://<YOUR-PROJECT>.supabase.co/auth/v1/callback`
- **You already added this to Google Cloud Console in Step 2.4** ✓

**Additional Configuration** (Optional):
- **Skip nonce check**: Leave unchecked (default)
- **Authorized Client IDs**: Leave empty unless you need specific client ID filtering

### 3.3 Save Configuration

1. Click **Save** at the bottom of the Google provider settings
2. Wait for the confirmation message

---

## Step 4: Update Extension Manifest (if needed)

The manifest should already have the `identity` permission. Verify in `manifest.json`:

```json
{
  "permissions": [
    "storage",
    "sidePanel",
    "identity"
  ]
}
```

✅ This is already configured in your extension.

---

## Step 5: Test Google Sign-In

### 5.1 Rebuild Extension

```bash
cd extension
npm run build
```

### 5.2 Reload Extension

1. Go to `chrome://extensions`
2. Click the **Reload** button on your Engram extension
3. Or remove and re-load the extension from `build/chrome-mv3-prod`

### 5.3 Test Authentication

1. Open the Engram extension (click the extension icon or open sidepanel)
2. Click **"Sign in with Google"**
3. You should see the Google OAuth consent screen
4. Grant permissions
5. You should be redirected back and signed in

**Expected Flow**:
1. Click "Sign in with Google"
2. Google OAuth popup appears
3. Select your Google account
4. Grant permissions (email, profile)
5. Popup closes
6. Extension shows "Signed in with Google!" toast
7. You're now authenticated

---

## Troubleshooting

### Error: "Authorization page could not be loaded"

**Cause**: Google OAuth credentials not configured in Supabase.

**Solution**: Complete Step 3 above (Configure Supabase with Google Client ID and Secret).

---

### Error: "Redirect URI mismatch"

**Cause**: The Chrome extension redirect URL isn't added to Google Cloud Console.

**Solution**:
1. Get your extension's redirect URL: `https://<EXTENSION-ID>.chromiumapp.org/`
2. Add it to **Google Cloud Console > Credentials > OAuth 2.0 Client ID > Authorized redirect URIs**
3. Also ensure `https://<PROJECT>.supabase.co/auth/v1/callback` is added
4. Click **Save**

---

### Error: "OAuth flow cancelled"

**Cause**: User closed the OAuth popup or denied permissions.

**Solution**: Try again and grant permissions when prompted.

---

### Error: "Access blocked: This app's request is invalid"

**Cause**: OAuth consent screen not configured properly.

**Solution**:
1. Go to **Google Cloud Console > OAuth consent screen**
2. Ensure all required fields are filled
3. Add your email as a test user (if app is in testing mode)
4. Save and try again

---

### Error: "This app isn't verified"

**Cause**: Your app is in testing mode and hasn't been verified by Google.

**Solution** (for testing):
1. When you see the warning, click **"Advanced"**
2. Click **"Go to Engram (unsafe)"**
3. This is normal for apps in development/testing

**Solution** (for production):
- Submit your app for [Google verification](https://support.google.com/cloud/answer/9110914)
- This requires a verified domain and privacy policy

---

### Still having issues?

1. **Check Supabase logs**: Go to Supabase Dashboard > Logs > Auth Logs
2. **Check Chrome DevTools**: Open DevTools for the extension background service worker and check for errors
3. **Verify credentials**: Double-check that Client ID and Secret are correct in both Google Cloud Console and Supabase
4. **Test with Supabase directly**: Use Supabase's built-in test functionality to verify OAuth works

---

## Production Deployment

When you're ready to publish the extension to Chrome Web Store:

1. **Get a stable Extension ID**:
   - Published extensions have a permanent ID
   - Update your OAuth redirect URL with this permanent ID

2. **Verify your app with Google**:
   - Required if requesting sensitive scopes
   - Requires a verified domain
   - [Google verification guide](https://support.google.com/cloud/answer/9110914)

3. **Update OAuth consent screen**:
   - Change from "Testing" to "In production"
   - Add required privacy policy URL
   - Add terms of service URL

4. **Update Supabase redirect URLs**:
   - Ensure production extension ID is configured
   - Test thoroughly before launch

---

## Security Notes

- ✅ Never commit Google Client Secret to version control
- ✅ Client ID and Secret are stored securely in Supabase (not in extension code)
- ✅ OAuth flow happens in a secure popup managed by Chrome
- ✅ Access tokens are handled by Supabase SDK
- ✅ Extension only receives the final session token

---

## Summary Checklist

- [ ] Get Chrome extension redirect URL
- [ ] Create Google Cloud project
- [ ] Configure OAuth consent screen
- [ ] Create OAuth 2.0 Client ID
- [ ] Add redirect URIs to Google Cloud Console
- [ ] Copy Client ID and Client Secret
- [ ] Enable Google provider in Supabase
- [ ] Paste credentials into Supabase
- [ ] Save Supabase configuration
- [ ] Rebuild extension
- [ ] Test Google Sign-In

---

**Need help?** Open an issue on GitHub or check Supabase documentation:
- [Supabase Google OAuth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/identity/)
