# TPT rules that govern the handout → demo funnel

Read from TPT's own help centre on 2026-08-25, not from seller blogs. Their help
pages block automated fetches; these were read in a browser.

Not legal advice. TPT enforces at its own discretion and changes these pages.
Re-read before betting the business on any line below.

---

## The plan being checked

Free printable pixel-art puzzles on TPT. Each handout carries a QR code and URL
to the SAL0MANder demo lesson. The printable is the lead magnet; the web app is
the product.

**Verdict: the plan is allowed as written, and it stops being allowed the moment
the linked site becomes a store.** Details below.

---

## The four rules that matter

### 1. QR codes and hyperlinks are explicitly permitted

> "Generally, hyperlinks and QR codes to content that **supplements** your TPT
> resource (like a blog post, newspaper article, a video) can be safe options."

Two conditions attached: the destination must have the right to host what it
hosts (ours does — it is our own work), and you must check the destination has
no "no link" policy (ours does not — it is ours).

This is the rule the funnel runs on. A QR to a free supplementary activity is
the named safe case.

### 2. You may not require an account anywhere else

> "You may not require the purchase, subscription, or registration of an account
> with any other websites or services to access your full resource."

**Guest Play already satisfies this**, and it is a non-negotiable in `CLAUDE.md`:
"Guest Play is never gated. No account, email, password, or name prompt on the
path from a share link to playable content."

A product decision made for students turns out to be a compliance requirement.
Adding a sign-up wall to the play path would break TPT's rules, not just the
charter.

### 3. No links to alternative sales channels

> "Don't direct Users to alternative sales channels. TPT should not be used as a
> way to drive traffic to another website or business. You may not include
> hyperlinks to alternative sales channels such as another online marketplace or
> e-commerce site where your resources can be purchased."

And separately:

> "Don't link to stores outside of TPT or advertise stores outside of TPT from
> TPT. (Another variation of this: Don't push folks who have come to you through
> TPT to other places to buy outside of TPT.)"

The enforceable sentence names **sales channels** — marketplaces and e-commerce
where your resources can be purchased. A free, ungated activity is not that.

But the middle sentence is broad: *"TPT should not be used as a way to drive
traffic to another website or business."* That is the clause that would be cited
if TPT ever objected, and it is a judgement call, not a bright line.

**The practical line: the page a scanned QR lands on must not sell anything and
must not advertise anything for sale.**

### 4. Broken links can cost you the product

> "If you provide hyperlinks or QR codes in your TPT products, it will be up to
> you to make sure that your linked resources are current and accessible. If the
> links are outdated or the content has been removed from the system you linked
> to, **we may have to issue a refund to Buyers and deactivate your product.**"

Reinforced in the Seller Guidelines:

> "if any part of your resource content is hosted on another platform or relies
> on a third party service, you must maintain third party content at all times."

**This is the rule with teeth, and it is the one this repo is least ready for.**
Site uptime stops being a quality concern and becomes a condition of keeping
products listed. On 2026-08-24 the deploy pipeline's own verifier documented that
"a blank site shipped past a fully green pipeline for three days." That is now a
TPT compliance event, not just an embarrassment.

Also relevant: 2026-08-24's Championship board reported the site dead when it was
serving HTTP 200, and reported it alive on other days without checking. Uptime
signals have to be trustworthy before they can protect a listing.

### 5. Price consistency

> "You may not charge more on TPT for a resource that is offered for free or less
> elsewhere."

Free-on-TPT and free-on-our-site is consistent. This becomes live the day
anything is charged for in either place.

---

## What this means for the product, concretely

**Land the QR on a clean play page, not the site root.** The scanned URL should
go straight to `/play/<code>`. A landing page carrying shop navigation, pricing,
or "sign up" reads much more like "driving traffic to another business" than a
puzzle that just starts. The deep link is both better UX and lower risk.

**Keep the student path free of commerce forever.** Not just unpriced — free of
buy buttons, plan comparisons, and upgrade prompts. If SAL0MANder ever sells
subscriptions, the storefront must live somewhere a TPT handout never points to.

**Every published handout is a permanent obligation.** Printables get downloaded,
saved, and photocopied for years. A link printed today must still resolve in
three years or TPT can refund and deactivate. Prefer a stable custom domain over
`samco1983.github.io/SAL0MANder-Web/...`, which is tied to one GitHub account and
one repository name.

**Uptime monitoring is now a business requirement.** Something must notice within
hours if the play URL stops resolving. Nothing in this repo does that today, and
the checks that claim to have been wrong in both directions.

---

## The trap to see coming

The funnel is compliant today because the destination is free and sells nothing.
The business plan presumably ends with SAL0MANder earning money.

The day a store appears on that domain, **every handout already published — and
already downloaded, saved, and photocopied — becomes a link from TPT to a
commercial site.** Those handouts cannot be recalled.

Design the URL structure for that future now: keep the played activity on a path
that can stay free and non-commercial permanently, and put anything commercial on
a separate host or path that no printable ever references.

TPT also publishes "Can I sell subscriptions to my website on TPT?" — read it
before building any paid tier.

---

## Sources

- Guidelines around utilizing other sites — help.teacherspayteachers.com, article 360044219551
- What are TPT's Seller Guidelines? — article 360042626591
- Is it ok to include hyperlinks or QR codes to other websites in my resources? — article 360043004671
- Can I offer resources that are hosted on a third party site? — article 360042199032

---

## Addendum — subscriptions, verified 2026-08-25

Read directly, because a second opinion asserted it and it is load-bearing:

> "No, subscriptions to external websites are not permitted. We're also not able
> to support a recurring subscription payment model. All resources posted on TPT
> must fall within the TPT Content Guidelines."

— *Can I sell subscriptions to my website on TPT?*, TPT help centre

This closes the question of whether a paid SAL0MANder tier could ever be sold
through TPT. It cannot, in either direction: not as a subscription product, and
not as a link to one.

It also sharpens the trap named above. The separation between the two businesses
is not a preference — it is the only configuration TPT permits.

## The two-storefront model — adopted

Not "TPT feeding a funnel to SAL0MANder", but two product lines under one brand:

```text
                  SAL0MANder Studios
                          |
          +---------------+---------------+
          |                               |
        TPT                        SAL0MANder Web
   printable classroom            interactive activities
   resources, worksheets,         Guest Play, Teacher Studio,
   lesson packets, keys           progress, results
```

Same brand, same educational philosophy, same content pipeline — different
products, different channels. The bridge is brand recognition, not a checkout
link.

This is stronger commercially than any workaround, because it does not depend on
a rule staying favorable. It is also the only shape compatible with the
subscription prohibition above.

**The consequence for content:** a verified question set can feed both lines, so
one human QA investment supports two businesses. That makes an extraction and
verification pipeline commercially load-bearing rather than housekeeping, and it
needs two gates, not one:

1. **Academic QA** — is the question correct, is there exactly one defensible
   answer, are the distractors legitimate.
2. **Rights QA** — may SAL0MANder distribute this commercially at all.

TPT requires Sellers to own or license everything they sell. Building a large
verified library and discovering most of it cannot legally ship is a failure that
only shows up after the work is done, which is the class of failure this repo
keeps finding. Classify every source before extracting from it.

**The metric worth measuring first:** how many human minutes it takes to turn one
real nine-question lesson into a ship-ready verified activity. Measure that on
one lesson before building hundreds of listings on either side.

## What a second opinion missed, and it is the one with teeth

An outside analysis of this plan covered links, sales channels, third-party
hosting, price consistency, and rights — and did not mention the uptime clause at
all.

That is the rule that can actually cost listings:

> "it will be up to you to make sure that your linked resources are current and
> accessible. If the links are outdated or the content has been removed... we may
> have to issue a refund to Buyers and deactivate your product."

For a **free** resource the refund half has little bite — there are no buyers to
refund. **Deactivation still applies.**

Nothing in this repo monitors whether the play URL resolves. The checks that
claim to were wrong in both directions inside 24 hours on 2026-08-24: the board
reported a live site dead, and reported a locked-out worker healthy for four
days. Uptime signals have to be trustworthy before they can protect a listing.
