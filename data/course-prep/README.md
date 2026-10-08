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

## Shared course catalog (v217)

`catalog.json` lists supported routings. `<id>.json` stores course identity, exact
aliases, independent storage key, bounds, sourced tee rows and hole-to-OSM-way IDs.
`<id>-osm.json` retains original coordinates, way IDs, versions and source tags.
Run `node scripts/build-course-prep.cjs` after editing a pack. Commit the generated
`course-prep-data.js` alongside it; `--check` is a publication gate. Add each new
source subset to the service-worker assets. No provider credential is part of a pack.

New courses are Wianno Club (Osterville, MA) and Sterling Farms Golf Course
(Stamford, CT), 18 holes each. The course picker and all live-map buttons share the
same renderer. Exact declared aliases match names; ambiguous layouts must be separate
packs. Preserve `poundRidge` as Pound Ridge’s storage key for existing installs.
New courses store notes/targets/reviews separately. Navigating never migrates or
rewrites the player’s rounds, club data, or previously saved Pound Ridge plan.

Wianno’s Blue card was read from
https://18birdies.com/golf-courses/club/959eb2a0-86ac-11e4-8c28-020000005b00/wianno-club
on October 8, 2026: 3,031 out + 3,055 in = 6,086 yards, par 70. Pars and stroke
indexes also match the existing sourced Caddie HQ standing card. Other providers
publish differing yardages; this pack explicitly identifies the Blue card above.
No club illustration or independently verified rating is asserted for Wianno.

Sterling’s Blue card was read from
https://www.grassy.golf/courses/sterling-farms-golf-course-us-ct/scorecard
on October 8, 2026: 3,069 out + 3,089 in = 6,158 yards, par 72. It is labeled a
third-party published card, not an official current club transcription. Ratings are
unset. Both packs ask the golfer to check against the course’s card.

Sterling’s official tour https://www.sterlingfarmsgc.com/-course-video-tour links
17 available hole images on https://cdn.cybergolf.com/images/1928/holeN.jpg .
The source page’s hole-12 link points at a broken legacy path, so hole 12 deliberately
has no illustration. It opens the interactive map. These remain external images;
they are not cached or rehosted. Wianno likewise opens the map when no guide exists.

Both new OSM subsets were retrieved October 8, 2026 from the exact API URLs stored
in their files. All 18 numbered centerlines match the published par sequence.
The same reference-tee, approximate-distance and incomplete-hazard limitations apply
as for Pound Ridge. Do not infer tee colors, daily pin locations, hazard completeness
or safe landing areas from this geometry. No Google-derived geometry is persisted.

Coverage review: Wianno hole 2 is retained as source data but marked `mapReady:false`.
Its source endpoint is near a tagged tee (way 989266485) rather than a confirmed green.
No map yardages, Google pins, or live-map button are shown for that hole; its card and
saved club/note remain usable. Do not silently snap the endpoint to a nearby green.
This first catalog therefore has 54 scorecard holes and 53 enabled interactive maps.
