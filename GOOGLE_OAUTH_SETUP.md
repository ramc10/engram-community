# Google OAuth Setup for Engram Extension

## Current Extension ID
Your extension is currently loaded with a temporary ID. To enable Google OAuth, you need a consistent extension ID.

**To find your current extension ID:**
1. Go to `chrome://extensions/`
2. Find "Engram" extension
3. Copy the ID (e.g., `lmllimnaodpmfabilfekgdkkncgcjbpg`)

## Step 1: Configure Supabase Google Provider

### 1.1: Enable Google Provider
1. Go to https://app.supabase.com/project/wtylimoxssbgurawreps/auth/providers
2. Click on "Google" provider
3. Enable it
4. Get OAuth credentials:
   - Go to Google Cloud Console: https://console.cloud.google.com/
   - Create a new project (or use existing)
   - Enable Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Name: "Engram Extension"

### 1.2: Configure OAuth Redirect URIs

**Authorized redirect URIs** (add both):
```
https://wtylimoxssbgurawreps.supabase.co/auth/v1/callback
https://<YOUR_EXTENSION_ID>.chromiumapp.org/
```

Replace `<YOUR_EXTENSION_ID>` with your actual extension ID.

### 1.3: Add Client ID and Secret to Supabase
1. Copy the Client ID and Client Secret from Google Cloud Console
2. Paste them into Supabase Google provider settings
3. Click "Save"

## Step 2: Configure Extension Redirect URL

### 2.1: Add Extension URL to Supabase
1. In Supabase Dashboard → Authentication → URL Configuration
2. Add to "Redirect URLs":
   ```
   https://<YOUR_EXTENSION_ID>.chromiumapp.org/
   ```

## Step 3: Test Google Sign-In

1. Reload the extension in Chrome
2. Navigate to a supported site (ChatGPT, Claude, or Perplexity)
3. Open Engram side panel
4. Click "Sign in with Google"
5. Complete OAuth flow

### Expected Result:
- ✅ Google login popup opens
- ✅ You authorize the app
- ✅ Redirected back to extension
- ✅ Successfully logged in
- ✅ Console log: `[Auth] Signed in with Google!`

## Troubleshooting

### Error: "redirect_uri_mismatch"
**Cause:** Redirect URI not configured correctly in Google Cloud Console

**Fix:**
1. Check your extension ID is correct
2. Ensure `https://<EXTENSION_ID>.chromiumapp.org/` is added to authorized redirect URIs in Google Cloud Console

### Error: "OAuth flow cancelled"
**Cause:** User closed the popup or network issue

**Fix:**
- Try again
- Check internet connection
- Ensure popup blocker is disabled

### Error: "Google provider not enabled"
**Cause:** Google provider not configured in Supabase

**Fix:**
1. Go to Supabase Dashboard
2. Enable Google provider
3. Add Client ID and Secret

### Error: "No access token in OAuth response"
**Cause:** OAuth flow didn't return tokens

**Fix:**
1. Check Supabase Google provider is enabled
2. Verify redirect URIs match exactly
3. Check Supabase logs for errors

## Alternative: Email/Password Only

If Google OAuth is too complex for initial testing, you can:
1. Use email/password authentication (already working)
2. Test core functionality first
3. Add Google OAuth later before production launch

## Production Deployment

When publishing to Chrome Web Store:
1. Extension will get a permanent ID
2. Update Google Cloud Console redirect URIs with production extension ID
3. Update Supabase redirect URLs
4. Re-test OAuth flow
