# Product photography

Drop the shots here, then:

    npm run seed:images -- --dry-run    # check the mapping first
    npm run seed:images                 # upload to Cloudinary and attach

## Naming

Files are matched to products by filename:

    <product-slug>-<n>.<ext>

| File | Goes to | Position |
|---|---|---|
| `intense-1.jpg` | Avenues Intense | primary |
| `intense-2.jpg` | Avenues Intense | second |
| `blue-mist-1.jpg` | Avenues Blue Mist | primary |
| `night-drip-1.jpg` | Avenues Night Drip | primary |
| `pink-aura-1.jpg` | Avenues Pink Aura | primary |
| `white-oud-1.jpg` | Avenues White Oud | primary |
| `discovery-set-1.jpg` | the Discovery Set | primary |

Anything after the number is ignored, so `intense-2-on-marble.jpg` is fine and
keeps the shot self-describing. A file matching no slug is listed in the output
rather than skipped quietly.

## These files are the source, not what the site serves

They are uploaded to Cloudinary and the site serves the CDN copy. This folder
is a working directory — it is not deployed, and nothing reads from it at
runtime.

That is deliberate. Images the admin panel can manage have to be Cloudinary
assets: deleting one purges the CDN by `publicId`, which a committed local file
does not have. Seeding to `public/` would have made seeded and uploaded images
two different kinds of thing, and only one of them fully editable.

## After the first run

The admin panel owns them. Add, reorder, re-caption or replace from
Products -> (a product) -> Images. Re-running this script skips products that
already have images unless you pass `--replace`, which purges the old
Cloudinary assets before uploading the new ones.
