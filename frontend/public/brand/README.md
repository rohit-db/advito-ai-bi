# Brand assets

Swap these files in place to rebrand (keep the filenames):

- `logo.svg` — full logo (sidebar expanded, login). ~140×32.
- `mark.svg` — compact square mark (collapsed sidebar, favicon source). ~32×32.
- `favicon.svg` — browser tab icon.

Paths are referenced from `brand.config.json` (`identity.logo` / `logoMark` /
`favicon`). If a file is absent, the UI falls back to a monogram generated from
`identity.shortName`.
