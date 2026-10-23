# Google sign-in

The API's `GET /auth/providers` checks Supabase's public provider settings. It returns a Google authorize URL only when the Google provider is enabled and `AUTH_REDIRECT_URL` is configured. The login screen then displays Continue with Google.

## Provider configuration

1. In Google Cloud, configure the OAuth consent screen for the application and create a Web application OAuth client.
2. Add `https://ycdfvwtrcpyzvexlfkwk.supabase.co/auth/v1/callback` as an authorized redirect URI.
3. Enter the client ID and secret in Supabase Authentication → Sign In / Providers → Google and enable it. Keep the secret in the provider settings, never in frontend source.
4. Keep `https://dsvv.live/contrigraph/` in Supabase's allowed redirect URLs and set `AUTH_REDIRECT_URL` to that address on the API.
5. Test Continue with Google using a permitted test account if the consent screen is in testing mode. Complete Google's publishing requirements before offering it to all users.

Supabase sends the verified session back to the public homepage. ConfirmationBridge forwards its fragment to `/contrigraph/app/`, where the existing callback exchanges the verified identity for a server session. Neither tokens nor credentials are stored by the public product page.

The production Google provider is enabled and the authorized redirect URI points to the Supabase callback. AUTH_MODE=google disables email/password login, signup, and resend in the production API. The public sign-in page offers Google only. The authorization redirect has been tested through Google�s account chooser; final consent and a complete sign-in remain user-controlled. The Google client is in testing mode, so only allowed test accounts can authenticate. OAuth client secrets are held only in the Supabase provider configuration, not the repository.
