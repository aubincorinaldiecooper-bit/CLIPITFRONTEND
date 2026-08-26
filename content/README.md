# The landing page

`landing-v57.html` is the owner's page, stored verbatim except for one edit:
its three "Try free" links point at `/start` instead of the placeholder
signup domain it shipped with.

It is served at `/` by `app/route.ts`. Do not rebuild it in React — update it
by replacing this file with the owner's next version and re-applying the one
link edit.

## Media it expects

The page references nine videos by relative URL, which resolve to the site
root — so each belongs in `public/`:

    public/source.mp4          the hero demo video
    public/who1.mp4 .. who3.mp4    the "who it's for" loops
    public/clip1.mp4 .. clip6.mp4  the results carousel

Until they exist the page still renders — every player has a poster image
built into the file — but nothing plays.

## Placeholders deliberately left

The `og:`/`canonical` URLs still say `your-domain.com`, as the file's own
TODO notes. They need the real domain before launch; that name is the
owner's call.
