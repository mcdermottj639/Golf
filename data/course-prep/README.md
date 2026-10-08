# Pound Ridge course preparation sources

Scorecard: https://www.poundridgegolf.com/golf/scorecard and the club's linked
https://www.poundridgegolf.com/images/documents/00021.png, read October 8, 2026.
The image itself is dated **01/24**. All seven tee yardage rows, pars and stroke
indexes were transcribed and checked against the printed front/back/total sums.
Ratings are the **men's** row. Pine has no men's rating on that card, so none is
inferred from the women's row. The public scorecard overrides older third-party
ratings through a new apply-once layout entry; old records are not rewritten.

Hole illustrations are loaded from the club's own course overview, with attribution
and links. They are artistic diagrams, not georeferenced distance-measurement surfaces.
They are not copied into this repository or the offline cache.

`pound-ridge-osm.json` is an unmodified-coordinate subset of OpenStreetMap ways
retrieved October 8, 2026, with original way IDs, versions and source URL. The
subset includes all 18 numbered hole centerlines. The route begins at an
**unspecified reference tee**, not necessarily the selected scorecard tee box,
and ends at a mapped green point, not today's flag. Fairways, greens, bunkers and
water are incomplete. Never turn absence of a mapped hazard into a safety claim.

Map data © OpenStreetMap contributors, available under the Open Database License:
https://www.openstreetmap.org/copyright
https://opendatacommons.org/licenses/odbl/1-0/
The downloadable source JSON supplies the corresponding database subset under
ODbL 1.0. `course-prep-data.js` contains the same coordinates for offline loading.
No Google imagery or Google-derived geometry is persisted in this dataset.

Planning prompts are Caddie HQ preparation suggestions, not club-authored advice.
Existing researched briefings remain accessible in the normal Round Prep list.
Playing distances read the current bag. The optional range source reads the latest
available struck-shot batch for each club and labels its date, sample and setup;
it never changes the playing carry. Rollout is an explicitly entered planning
assumption, and carry rings represent distance rather than measured shot dispersion.

Google Maps setup: enable Maps JavaScript API in a billing-enabled Cloud project.
Use a browser API key restricted to Maps JavaScript API and the production website
`https://mcdermottj639.github.io/*` (Google may reduce referrers to the origin).
For local testing add the exact localhost development origin separately. Set quotas
and billing alerts in Google Cloud. Enter the key in Course Prep → Google Maps setup.
It is stored only in `caddiehq_google_maps_key_v1`, outside golf backups. A deployment
may instead set `window.CADDIE_GOOGLE_MAPS_KEY` before loading the planner.
Neither a key nor billing is required for the course route map or saved strategies.

Google requests are lazy: opening Course Prep or the official guide does not load
the Maps API. Only selecting Satellite or 3D with a configured key does so. Map
instances are reused across holes; authentication errors, offline use and unsupported
3D rendering leave the course map and saved plan available. The service worker caches
only same-origin content and never caches Google map responses or external imagery.
