# Public product tour

The portfolio includes a 2-minute 12-second English product explainer at
https://dsvv.live/contrigraph/#watch. It explains planning, My work, dependencies,
shared capacity, the single-specialist case, preview and approval, help requests,
reviews and contribution reports using illustrative team examples.

## Website files

- `apps/web/components/ProductTour.tsx` and `.css`: responsive player, chapter buttons, transcript and credits.
- `apps/web/lib/product-tour.ts`: chapter timestamps and spoken transcript.
- `apps/web/public/media/contrigraph-product-tour-en-v1.*`: MP4, poster, English WebVTT captions and attribution.

The player uses native controls and reserves a 16:9 area. It does not autoplay or
preload the MP4. Captions can be toggled, and the complete transcript remains
available without playing the video. Media URLs respect `NEXT_PUBLIC_APP_BASE_PATH`.

## Export and maintenance

The MP4 is 1920×1080 at 30 fps with H.264 video and AAC audio, about 7.4 MB.
The editable Hyperframes composition and render intermediates remain in the
ignored local folder `brag-output-2026-10-24-product-en/`; only delivery assets
belong in the repository. Preserve that folder separately for future edits.
When replacing the video, update all media, chapter times and transcript together.
Use a new versioned filename for changed content.

Music is by Sascha Ende under CC BY 4.0. Keep the displayed attribution and the
media credits file. Sound effects are Kenney CC0; narration uses Kokoro.

Build with `NEXT_PUBLIC_APP_BASE_PATH=/contrigraph` for the VPS deployment.
After deployment, run `node scripts/verify-production.mjs` for route, range-request,
caption and poster checks. Also check playback, chapter seeking, captions and
responsive layout in a browser. Keep a rollback build until live checks pass.
