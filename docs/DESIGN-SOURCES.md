# Design and component sources

The interface uses DM Sans and Manrope, warm paper surfaces, sage operational data, and terracotta actions. It avoids the user’s listed design patterns. Shader motion is decorative and does not encode schedule information.

- React Bits CountUp: `components/CountUp.tsx`, copied from the official TypeScript/CSS source at https://github.com/DavidHDev/react-bits. License in `REACT-BITS-LICENSE.txt`.
- GSAP: page navigation movement only, not scroll-triggered section fades. https://gsap.com/
- Lenis: document scrolling with reduced-motion opt-out. https://github.com/darkroomengineering/lenis
- Vengeance UI CornerButton: adapted from https://github.com/Ashutoshx7/VengenceUI/blob/main/src/components/ui/corner-button.tsx. Simulator entry uses a flat custom theme, inherited font and no fade-on-hover. MIT license in `VENGEANCE-LICENSE.txt`.
- Skiper UI: https://skiper-ui.com/v1/skiper40, free CssLink family. Attribution required for free components. Integration status is recorded in the source component.
- Animmaster Lib: https://animmasterlib.dev/webgl. Its source is distributed through paid packs; no licensed pack was supplied, so its source has not been copied or represented as installed. `SignalShader.tsx` is an original WebGL implementation. A licensed component can replace it later.
- Icons: Phosphor Icons. Dependency visualization: React Flow.

No private template packs or premium components are bundled.
