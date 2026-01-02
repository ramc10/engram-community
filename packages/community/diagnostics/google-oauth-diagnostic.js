/**
 * Google OAuth Diagnostic Tool
 * Run this in the Chrome DevTools console (Background Service Worker)
 * to diagnose Google OAuth configuration issues
 */

console.log('=== GOOGLE OAUTH DIAGNOSTIC ===\n');

// 1. Check Chrome Identity API
console.log('1. Chrome Identity API:');
if (chrome.identity) {
    console.log('   ✅ chrome.identity API is available');

    try {
        const redirectUrl = chrome.identity.getRedirectURL();
        console.log('   ✅ Redirect URL:', redirectUrl);
        console.log('   📝 Add this URL to Google Cloud Console > OAuth Client > Authorized redirect URIs');
    } catch (e) {
        console.log('   ❌ Failed to get redirect URL:', e.message);
    }
} else {
    console.log('   ❌ chrome.identity API is NOT available');
    console.log('   ⚠️  Check if "identity" permission is in manifest.json');
}

// 2. Check Extension ID
console.log('\n2. Extension ID:');
const extensionId = chrome.runtime.id;
console.log('   📝 Extension ID:', extensionId);
console.log('   📝 Expected redirect URL:', `https://${extensionId}.chromiumapp.org/`);

// 3. Check Supabase Configuration
console.log('\n3. Supabase Configuration:');
chrome.storage.local.get(null, (items) => {
    const supabaseKeys = Object.keys(items).filter(key =>
        key.includes('supabase') || key.includes('sb-')
    );

    if (supabaseKeys.length > 0) {
        console.log('   ✅ Supabase data found in storage');
        console.log('   📝 Keys:', supabaseKeys);
    } else {
        console.log('   ⚠️  No Supabase data in storage (might be normal before first auth)');
    }
});

// 4. Check Manifest Permissions
console.log('\n4. Manifest Permissions:');
const manifest = chrome.runtime.getManifest();
console.log('   📝 Permissions:', manifest.permissions);

if (manifest.permissions?.includes('identity')) {
    console.log('   ✅ "identity" permission is present');
} else {
    console.log('   ❌ "identity" permission is MISSING');
    console.log('   ⚠️  Add "identity" to permissions array in manifest.json');
}

// 5. Test OAuth URL Generation
console.log('\n5. Testing OAuth URL Generation:');
console.log('   🔄 Attempting to generate OAuth URL...');

// Try to import and test (this won't work if modules aren't loaded)
// This is just a diagnostic
setTimeout(() => {
    console.log('\n=== NEXT STEPS ===');
    console.log('\nIf you see errors about "Authorization page could not be loaded":');
    console.log('\n1. ✅ Ensure "identity" permission is in manifest.json (should be fixed now)');
    console.log('\n2. 📝 Configure Google Cloud Console:');
    console.log('   - Create OAuth 2.0 Client ID');
    console.log('   - Application type: "Web application" or "Chrome extension"');
    console.log('   - Add redirect URIs:');
    console.log(`     - https://${extensionId}.chromiumapp.org/`);
    console.log('     - https://<YOUR-SUPABASE-PROJECT>.supabase.co/auth/v1/callback');
    console.log('   - Copy Client ID and Client Secret');
    console.log('\n3. 📝 Configure Supabase Dashboard:');
    console.log('   - Go to Authentication > Providers > Google');
    console.log('   - Enable Google provider');
    console.log('   - Paste Google Client ID and Client Secret');
    console.log('   - Save configuration');
    console.log('\n4. 🔄 Reload the extension and try again');
    console.log('\nFor detailed instructions, see: extension/GOOGLE_OAUTH_SETUP.md');
}, 100);
