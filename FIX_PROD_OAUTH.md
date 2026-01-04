# Fix: Google OAuth Redirect Issue in Production Build

## Problem

When using the **production build**, Google OAuth redirects to `theengram.tech` instead of the Chrome extension URL.

## Root Cause

The production build has a **different extension ID** than the development build. Google OAuth is only configured for the dev extension ID, so when the prod build tries to authenticate, Google doesn't recognize it and redirects to the fallback URL.

## Solution

Add the production extension's redirect URL to Google Cloud Console.

---

## Step-by-Step Fix

### 1. Find Your Production Extension ID

1. Load the production extension in Chrome:
   ```bash
   # Load from chrome://extensions
   # Click "Load unpacked"
   # Select: packages/community/build/chrome-mv3-prod/
   ```

2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Find your **Engram** extension
5. Copy the **Extension ID** (looks like: `abcdefghijklmnopqrstuvwxyzabcdef`)

### 2. Get the OAuth Redirect URL

**Option A: Check Console Logs (Easiest)**

1. Open the Engram extension side panel
2. Try to click "Sign in with Google"
3. Open DevTools Console (F12)
4. Look for this log message:
   ```
   [Auth] Starting Google OAuth with redirect: https://xxxxx.chromiumapp.org/
   ```
5. Copy that URL

**Option B: Calculate Manually**

The redirect URL format is:
```
https://<EXTENSION_ID>.chromiumapp.org/
```

Replace `<EXTENSION_ID>` with your production extension ID from Step 1.

**Example**: If your extension ID is `abcdefghijklmnopqrstuvwxyzabcdef`, then your redirect URL is:
```
https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/
```

### 3. Add Redirect URL to Google Cloud Console

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID (e.g., "Engram Extension")
3. Under **"Authorized redirect URIs"**, click **"ADD URI"**
4. Paste your production redirect URL from Step 2:
   ```
   https://<PROD_EXTENSION_ID>.chromiumapp.org/
   ```
5. Ensure these URLs are also present:
   - Dev extension redirect URL (if you're using both builds)
   - Supabase callback: `https://wtylimoxssbgurawreps.supabase.co/auth/v1/callback`
6. Click **Save**

**Important**: Google changes can take 1-5 minutes to propagate. Wait a bit before testing.

### 4. Test Google Sign-In

1. Wait 2-3 minutes for Google to process the changes
2. Reload your extension in `chrome://extensions` (click the reload icon)
3. Open Engram side panel on ChatGPT, Claude, or Perplexity
4. Click **"Sign in with Google"**
5. Complete the OAuth flow

**Expected Result**: ✅ OAuth should now redirect back to the extension correctly!

---

## Quick Reference

**Production Extension Location**:
```
packages/community/build/chrome-mv3-prod/
```

**Redirect URL Format**:
```
https://<EXTENSION_ID>.chromiumapp.org/
```

**Google Cloud Console**:
- [Credentials Page](https://console.cloud.google.com/apis/credentials)
- Find: OAuth 2.0 Client ID → "Engram Extension"
- Add to: "Authorized redirect URIs"

**Supabase Callback URL** (should already be configured):
```
https://wtylimoxssbgurawreps.supabase.co/auth/v1/callback
```

---

## Alternative: Use a Consistent Extension ID

To avoid this issue in future builds, you can generate a consistent extension key:

### Generate Extension Key

```bash
cd packages/community

# Generate a private key (do this once)
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem

# Add to .gitignore to keep it private
echo "key.pem" >> .gitignore
```

### Configure Plasmo to Use the Key

Create or edit `.plasmorc` file:

```json
{
  "manifest": {
    "key": "<YOUR_PUBLIC_KEY>"
  }
}
```

To get the public key from your private key, you can use a Chrome extension key converter tool or upload the extension to Chrome Web Store (which gives you a permanent ID).

**Note**: This is optional and mainly useful if you need a consistent extension ID across multiple development builds.

---

## For Production (Chrome Web Store)

When you publish to Chrome Web Store:
1. The extension will get a **permanent, stable ID**
2. Update Google Cloud Console with the production extension ID
3. The redirect URL will be: `https://<PERMANENT_ID>.chromiumapp.org/`
4. This ID won't change even when you publish updates

---

## Troubleshooting

### Still redirecting to theengram.tech?

1. **Check Google Cloud Console**:
   - Verify the redirect URL is saved correctly
   - Ensure there are no typos
   - Wait 5 minutes for changes to propagate

2. **Check Extension ID**:
   - Make sure you're using the correct extension ID
   - The ID changes each time you load a different build folder

3. **Check Supabase**:
   - Verify Google provider is enabled in Supabase Dashboard
   - Check that Client ID and Secret are correct

4. **Check Console Logs**:
   - Open DevTools for the extension
   - Look for `[Auth]` messages
   - Check what redirect URL is being used

### Error: "redirect_uri_mismatch"

This means the redirect URL doesn't match what's configured in Google Cloud Console.

**Fix**:
1. Double-check the extension ID
2. Ensure the redirect URL in Google Cloud Console matches exactly
3. Format: `https://<EXTENSION_ID>.chromiumapp.org/` (with trailing slash)

### OAuth popup closes immediately

**Cause**: Extension ID changed or redirect URL not configured

**Fix**:
1. Follow steps above to add the correct redirect URL
2. Wait a few minutes
3. Try again

---

## Summary

The issue occurs because:
- **Dev build** extension ID: `xxxxx`
- **Prod build** extension ID: `yyyyy` (different!)
- Google OAuth only knows about `xxxxx`

**Solution**: Add **both** redirect URLs to Google Cloud Console:
- `https://xxxxx.chromiumapp.org/` (dev)
- `https://yyyyy.chromiumapp.org/` (prod)

Then OAuth will work for both builds!
