# School network: filtering confirmed, and the reason is fixable

**2026-08-30.** The coordination standard was: only treat it as filtering if an
actual vendor block page appears. One appeared.

## What was observed

A district filter block page, on the district network, signed in as a district
account:

- **Branding:** Sanger Unified School District
- **Message:** "Oops, **sal0mander.com** is not available because it is
  categorized as **Unknown**."
- **URL:** `localhost:6543/block?id=998901b0-…` — served by a filtering agent
  running **on the device**, not by a network appliance
- **Footer:** logged in as a `@sangerusd.net` account, IP `206.78.42.94`

This supersedes the earlier working theory. The previous symptom was
`ERR_SSL_PROTOCOL_ERROR` from a missing GitHub Pages certificate, which was
repaired and was never filtering. This is filtering, and it is separate.

## The reason matters more than the block

**"Categorized as Unknown" is not a content judgement.** The filter has no
category record for the domain, and the district's policy denies uncategorized
sites by default. That is the standard posture in K-12 — it is how a filter
handles a domain it has never seen, which describes every new domain.

Nothing about SAL0MANder was assessed and rejected. It was never assessed.

Consequences worth stating plainly:

- **This is not a code problem.** No web change, hosting change, or Unity change
  affects it. Shipping a better site does not clear it.
- **Migrating to `.org` would not fix it.** A new `.org` domain would also be
  uncategorized, and the owner has already ruled `.com` for both domains. Do not
  revisit that on the strength of this block.
- **It will affect every district**, not just Sanger, until the domain is
  categorized with the major filtering vendors.

## What actually clears it

Domain categorization review — a submission to the filtering vendor asking them
to classify `sal0mander.com` as Education. Every major vendor (Lightspeed,
Securly, GoGuardian, Cisco Umbrella, Fortinet, Zscaler) runs a free public form
for this. It is routine and typically takes days, not weeks.

Two paths, and the first is faster:

1. **Ask the district to allow it directly.** Sanger IT can whitelist a domain
   for the district without waiting on the vendor. The contact is already known:
   **Juan Serrano, Cybersecurity Manager**, who emailed Samuel on 2026-08-27.
   That request is ordinary and is the kind of thing a district does routinely
   for a teacher's classroom tool.
2. **Submit for categorization** with the vendors, which fixes it everywhere
   rather than at one district.

Identify the vendor before submitting: the block page is served from
`localhost:6543`, so a filtering agent is installed on the device. The district
can name it, or it will be visible in the machine's installed applications.

## What this does not license

Do not attempt to bypass, tunnel around, or otherwise evade the filter. The
correct path is categorization and a district allow request. Anything else is
both wrong and self-defeating for a product whose customers are districts.

## Sequencing

Both paths need a site that survives being looked at. A reviewer opening
`sal0mander.com` today sees "Foundation preview — placeholder visual design",
`env: local`, and a Console link — the fix for which is sitting unmerged in
PR #73 (and duplicated in #83).

**Land the production presentation fix before submitting for categorization.**
A reviewer who classifies the site while it presents as a developer build is a
reviewer classifying the wrong thing.
