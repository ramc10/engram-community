# ⚡ Google OAuth Setup - YOUR SPECIFIC VALUES

**Extension is ready! Now configure Google Cloud Console and Supabase.**

---

## 📋 Your Specific Values

Copy these values - you'll need them in Steps 2 and 3:

```
Extension ID: bepkojhfpkblbpjkdbgapbnkcieekhcl
Extension Redirect URL: https://bepkojhfpkblbpjkdbgapbnkcieekhcl.chromiumapp.org/
Supabase Project URL: https://wtylimoxssbgurawreps.supabase.co
Supabase Callback URL: https://wtylimoxssbgurawreps.supabase.co/auth/v1/callback
```

---

## Step 1: Configure Google Cloud Console

### 1.1 Go to Google Cloud Console

1. Open: https://console.cloud.google.com/
2. Create a new project OR select existing project
3. Project name suggestion: **"Engram Extension"**

### 1.2 Configure OAuth Consent Screen (First Time Only)

1. Go to: **APIs & Services > OAuth consent screen**
2. Choose **External** user type → Click **Create**
3. Fill in required fields:
   - **App name**: `Engram`
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click **Save and Continue** through all steps
5. **Add Test Users** (if app is in Testing mode):
   - Click **Add Users**
   - Add your Google account email
   - Click **Save**

### 1.3 Create OAuth 2.0 Client ID

1. Go to: **APIs & Services > Credentials**
2. Click: **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Select **Application type**: **Web application**
   - (If you see "Chrome extension" option, you can use that instead)
4. **Name**: `Engram Extension`
5. **Authorized redirect URIs** - Click **+ ADD URI** twice and add BOTH:
   ```
   https://bepkojhfpkblbpjkdbgapbnkcieekhcl.chromiumapp.org/
   ```
   ```
   https://wtylimoxssbgurawreps.supabase.co/auth/v1/callback
   ```
6. Click **CREATE**
7. **IMPORTANT**: A popup will show your credentials:
   - **Client ID**: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Copy BOTH values! You'll need them in Step 2

---

## Step 2: Configure Supabase

### 2.1 Enable Google Provider

1. Go to: https://app.supabase.com/
2. Select your **Engram** project (`wtylimoxssbgurawreps`)
3. Navigate to: **Authentication** → **Providers**
4. Find **Google** in the list and click to expand it

### 2.2 Enter Google Credentials

1. Toggle **Enable Sign in with Google** to **ON**
2. Paste your credentials from Step 1:
   - **Client ID (for OAuth)**: Paste the Client ID from Google Cloud Console
   - **Client Secret (for OAuth)**: Paste the Client Secret from Google Cloud Console
3. **Authorize redirect URL** should show:
   ```
   https://wtylimoxssbgurawreps.supabase.co/auth/v1/callback
   ```
   ✅ This should already be added to Google Cloud Console (you did this in Step 1.3)
4. Leave other settings as default
5. Click **Save** at the bottom

### 2.3 Verify Configuration

After saving, you should see:
- ✅ Google provider shows as **Enabled**
- ✅ Client ID is filled in (partially masked)
- ✅ No error messages

---

## Step 3: Test Google Sign-In

### 3.1 Reload Extension

1. Go to: `chrome://extensions`
2. Find your **Engram** extension
3. Click the **Reload** button (circular arrow icon)

### 3.2 Test Sign-In

1. Click the Engram extension icon in your Chrome toolbar
2. Click **"Sign in with Google"** button
3. **Expected flow**:
   - ✅ Google OAuth popup appears
   - ✅ Shows your Google account(s)
   - ✅ You can select an account
   - ✅ Shows permissions screen (if first time)
   - ✅ After accepting, popup closes
   - ✅ Extension shows "Signed in with Google!" message

### 3.3 If You See "Unverified App" Warning

If you see **"This app isn't verified"** warning:

1. This is NORMAL for apps in development/testing
2. Click **"Advanced"** (bottom left)
3. Click **"Go to Engram (unsafe)"**
4. Continue with sign-in

**For production deployment**: You'll need to submit for Google verification

---

## 🐛 Troubleshooting

### Error: "Authorization page could not be loaded"

**Cause**: Supabase Google provider not configured yet

**Solution**: Complete Step 2 above (Configure Supabase)

---

### Error: "Redirect URI mismatch"

**Cause**: Redirect URLs don't match

**Solution**: 
1. Verify BOTH URLs are added to Google Cloud Console:
   - `https://bepkojhfpkblbpjkdbgapbnkcieekhcl.chromiumapp.org/`
   - `https://wtylimoxssbgurawreps.supabase.co/auth/v1/callback`
2. Click **Save** in Google Cloud Console
3. Wait ~5 minutes for changes to propagate
4. Try again

---

### Error: "Access blocked: This app's request is invalid"

**Cause**: OAuth consent screen not configured

**Solution**: Complete Step 1.2 above (Configure OAuth Consent Screen)

---

### Still Not Working?

1. **Check Supabase Logs**:
   - Go to Supabase Dashboard → Logs → Auth Logs
   - Look for error messages

2. **Check Chrome DevTools**:
   - Open DevTools for Background Service Worker
   - Look for console errors

3. **Verify Credentials**:
   - Double-check Client ID and Secret in Supabase match Google Cloud Console
   - Ensure you saved changes in both places

---

## ✅ Success Checklist

- [ ] Created Google Cloud project (or selected existing)
- [ ] Configured OAuth consent screen
- [ ] Created OAuth 2.0 Client ID
- [ ] Added BOTH redirect URIs to Google Cloud Console
- [ ] Copied Client ID and Client Secret
- [ ] Enabled Google provider in Supabase
- [ ] Pasted credentials into Supabase
- [ ] Clicked Save in Supabase
- [ ] Reloaded Chrome extension
- [ ] Successfully signed in with Google

---

## 📝 Notes

- Your extension redirect URL will CHANGE if you:
  - Reinstall the extension
  - Publish to Chrome Web Store (gets permanent ID)
  
  When this happens, you'll need to update the redirect URL in Google Cloud Console.

- The Client ID and Secret should NEVER be committed to your code repository. They stay in Supabase securely.

---

**Ready to configure? Start with Step 1!** 🚀
