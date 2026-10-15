# CDI catalog ordering

Reading and Listening keep full papers first and the existing source priority, then use numeric-aware title order (1, 2, 3, …, 10, 11). Writing Task 1/2, Speaking sets, legacy Speaking practice and teacher-only CDI samples use the same `compareTestTitles` comparator. IDs break title ties.

The Reading/Listening/Speaking catalog cache versions were advanced so a deployment does not retain the previous timestamp-based order. Database records, source numbers, IDs, answer keys, attempts and media are unchanged. Numbering gaps from quarantined/missing source papers are preserved; no missing paper is fabricated or renumbered. Unnumbered teaching resources remain alphabetically ordered and show a sequential display position (`Resource 1`, etc.), not a new official test ID or Speaking score.

Regression coverage: numeric ordering across all four skills and both Writing tasks, leading zeros, numbering gaps, tie-breaking and catalog wiring. The comparator was also checked locally against metadata for all 236 previously restored CDI records, without publishing any private questions or keys.
