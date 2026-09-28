# design/reference — approved card-system reference images

Drop the approved reference files here (owner input; the visual loop's source
of truth). Expected files, any of `.png` / `.jpg` / `.webp`:

| file                     | contents                                       |
| ------------------------ | ---------------------------------------------- |
| `master-4star.*`         | the 4-star Platinum master card (HIGHEST prio) |
| `finishes-strip.*`       | the five-finish progression strip              |
| `staff-row.*`            | the staff-card row                             |
| `sample-athlete.*`       | Cason Wallace sample photo (dev-only cutout)   |

Every image in this folder appears automatically in the `/card-preview`
overlay picker (dev only — served by `/api/dev/reference/<name>`, which is
disabled in production builds).

The overlay renders the reference at exactly the card's dimensions with an
opacity slider — the primary correction instrument of the visual loop.
Approval authority is HUMAN VISUAL APPROVAL (Δ14); pixel diffs only guard
regressions after the GEOMETRY LOCKED milestone.
