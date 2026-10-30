# CDI catalog ordering and display numbers

Available CDI papers are ordered naturally by their original source titles (2 before 10), then assigned contiguous **display numbers** starting at 1. Missing or quarantined source files no longer leave visible holes in the unfiltered library. No missing paper is fabricated or published.

- Reading and Listening retain the full/practice split and source priority. Original CDI and each Volume collection have independent display sequences.
- Writing Task 1 and Task 2 are numbered independently. Topic titles without a CDI test number stay unchanged.
- Numbers are assigned to the complete published catalog **before** difficulty/type filters, not separately per filtered page. Thus changing filters never renames a paper; a filtered subset can intentionally have gaps.
- Opened Reading/Listening papers resolve the same title by their existing ID; Writing list/detail already share the prompt resolver.
- Only returned presentation objects change. Database titles, source filenames/numbers, IDs, audio/diagram mappings, recording fingerprints, answer keys, attempts and historical results remain untouched. Bookmarks and allocated Mock attempts still resolve by their original IDs.
- Reading and Listening cache versions advance to `cdi-v5-contiguous-display` so previous names are not retained after deployment.
- Display numbering reflects available papers, not an external publisher's official test number. Adding/removing available papers may shift subsequent display positions; original IDs remain the permanent references.

Tests cover gaps, missing first files, natural ordering, collection and Writing task separation, unnumbered topics, immutable source objects, filter stability, empty catalogs, idempotence and consistent list/detail titles. Original Listening fingerprints are checked unchanged after a title alias.

The deployment guard also reads the published Reading, Listening and both Writing catalogs using the actual list resolvers, checks unique IDs and contiguous numbers per series, and logs only collection/count/range metadata. It does not update any database record.
