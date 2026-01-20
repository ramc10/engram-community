# Supabase Setup Guide for Chrome Extension OAuth

This guide explains how to properly configure Supabase for Google OAuth authentication in a Chrome extension.

## The Problem

Chrome extensions require a special redirect URL format for OAuth: `https://<extension-id>.chromiumapp.org/`

This creates challenges:
1. The extension ID changes between development and production builds
2. Supabase's "Site URL" setting affects OAuth redirects
3. Google OAuth provider must whitelist the correct redirect URLs

## Solution

### 1. Supabase Project Settings

Go to: **Project Settings > General > Configuration**

Set the **Site URL** to:
```
https://theengram.tech
```

⚠️ **Important**: The Site URL can be your website, but the OAuth redirect URLs will be dynamically handled by the extension code.

### 2. Google OAuth Provider Configuration

Go to: **Authentication > Providers > Google**

1. **Enable** the Google provider
2. **Add your Google OAuth Client ID and Secret**
3. **Configure Redirect URLs**:

#### For Development:
You need to add a wildcard pattern OR specific development extension IDs:
```
https://*.chromiumapp.org/*
```

Note: Supabase accepts this wildcard in the provider configuration.

#### For Production:
Add your published extension's redirect URL:
```
https://<YOUR_EXTENSION_ID>.chromiumapp.org/
```

To find your extension ID:
- Development: Run the extension and check `chrome.runtime.id`
- Production: Find it in the Chrome Web Store URL after publishing

### 3. Google Cloud Console Configuration

In your Google Cloud Console OAuth 2.0 Client:

1. Go to: **APIs & Services > Credentials > Your OAuth Client**
2. Add **Authorized redirect URIs**:
   ```
   https://<YOUR_EXTENSION_ID>.chromiumapp.org/
   https://your-project.supabase.co/auth/v1/callback
   ```

### 4. How It Works

The extension code automatically handles redirect URL mismatches:

1. Extension gets its redirect URL: `chrome.identity.getRedirectURL()`
2. Calls Supabase OAuth, which might return a URL with Site URL as redirect_uri
3. **The code automatically detects and replaces** incorrect redirect_uri with the correct extension URL
4. OAuth flow proceeds with the correct redirect URL

See: `packages/community/src/lib/auth-client.ts` lines 161-186

## Troubleshooting

### Error: "user didn't approve the access"

**Cause**: The OAuth redirect URL is misconfigured

**Solutions**:
1. ✅ Check that Google OAuth provider in Supabase has the correct redirect URLs
2. ✅ Verify Google Cloud Console has the extension redirect URL whitelisted
3. ✅ Rebuild and reload the extension to get the latest code
4. ✅ Check browser console for `[Auth]` logs showing the redirect URL detection

### Error: "OAuth flow cancelled"

**Cause**: User closed the OAuth popup without completing authentication

**Solution**: Try again and click "Allow" when Google asks for permissions

### Redirecting to theengram.tech

**Cause**: Supabase Site URL is used in OAuth URL, but the code should fix this

**Debug**:
1. Open browser console (F12)
2. Look for `[Auth]` log messages
3. Check if the code detects and fixes the redirect URL
4. Verify the "Updated OAuth URL" contains the correct extension redirect URL

### Extension ID keeps changing in development

**This is normal!** Plasmo generates a new extension ID for each development build.

**Workarounds**:
- Use a test Google account that doesn't mind re-authorizing frequently
- OR set up a permanent extension ID for development (see Plasmo docs)
- Production builds have stable extension IDs once published

## Environment Variables

In `packages/community/.env`:

```env
# Supabase Configuration
PLASMO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PLASMO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Testing OAuth Flow

1. Build and load the extension
2. Click "Sign in with Google"
3. Check browser console for `[Auth]` logs:
   ```
   [Auth] Starting Google OAuth with redirect: https://xxx.chromiumapp.org/
   [Auth] Current redirect_uri in OAuth URL: https://theengram.tech
   [Auth] Replacing with: https://xxx.chromiumapp.org/
   [Auth] Launching auth flow with URL: ...
   ```
4. Complete Google OAuth
5. Should redirect back to extension successfully

## Additional Resources

- [Chrome Extension Identity API](https://developer.chrome.com/docs/extensions/reference/identity/)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
