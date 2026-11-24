# SafeRide

SafeRide is a mobile-first scholar transport app. The current frontend preview
includes the first three PRD screens: login, sign-up and driver compliance.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the address printed by Vite. Run `npm test`, `npm run lint`,
`npm run typecheck`, and `npm run build` to validate changes.

## Preview limitations

This is **not an operational authentication system**. No accounts are created,
credentials sent, consent recorded, or documents uploaded. Form details live
only in browser memory and disappear when the page is refreshed or closed.
Privacy notice text and password reset are pending. Do not enter real personal
information or documents. Server-side validation, authorisation, private
storage and the rest of the PRD remain to be implemented before launch.

Design references in `docs/designs` are named `Sxx-screen-name.png`, using the
uppercase screen ID and full screen name from the PRD for easy sorting and
searching. They are visual references, not feature specifications: the PRD
takes precedence where a design includes out-of-scope features.
