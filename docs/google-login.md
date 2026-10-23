# Google sign-in

The API's `GET /auth/providers` checks Supabase's public provider settings. It returns a Google authorize URL only when the Google provider is enabled and `AUTH_REDIRECT_URL` is configured. The login screen then displays Continue with Google.

## Provider configuration

1. In Google Cloud, configure the OAuth consent screen for the application and create a Web application OAuth client.
2. Add `https://ycdfvwtrcpyzvexlfkwk.supabase.co/auth/v1/callback` as an authorized redirect URI.
3. Enter the client ID and secret in Supabase Authentication → Sign In / Providers → Google and enable it. Keep the secret in the provider settings, never in frontend source.
4. Keep `https://dsvv.live/contrigraph/` in Supabase's allowed redirect URLs and set `AUTH_REDIRECT_URL` to that address on the API.
5. Test Continue with Google using a permitted test account if the consent screen is in testing mode. Complete Google's publishing requirements before offering it to all users.

Supabase sends the verified session back to the public homepage. ConfirmationBridge forwards its fragment to `/contrigraph/app/`, where the existing callback exchanges the verified identity for a server session. Neither tokens nor credentials are stored by the public product page.

The current production Google provider is disabled. A successful provider configuration and an end-to-end sign-in test are required before claiming Google login is live.
