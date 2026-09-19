# Fonts downloaded from Ramp

Source: https://ramp.com/
Inspected: 19 September 2026

Verified: 13 original WOFF2 files downloaded. Each file has a valid WOFF2 signature and matching declared file length. SHA-256 hashes and original URLs are in sources.json.

## Included

- TWK Lausanne: 300, 350, 400, 700, each in normal and italic styles (8 files).
- IBM Plex Mono: 400 and 500, Latin subsets (2 files).
- IBM Plex Sans: 600, Latin subset (1 file).
- Material Icons and Material Icons Outlined: 400 (2 files).

The rendered homepage uses Lausanne 400 for the inspected headings, navigation and body text, with 400 italic also observed. The other Lausanne variants and the three IBM files were preloaded by the page; preloading does not prove visible use. The icon fonts are referenced by its stylesheet.

The shared CSS also defines additional language subsets, including IBM Plex Sans JP. These were not observed in the homepage asset inventory and are not included.

## Files

fonts.css contains the matching font-face declarations rewritten to use these local filenames, preserving weights, styles and Unicode ranges. These are webfont files, not desktop TTF/OTF installers. No font conversion was performed.

Only downloaded reference artifacts were added; no application fonts were changed and no dependencies were installed.

## Rights metadata

These files were downloaded from public website assets. No font reuse license was obtained or verified as part of this download.
