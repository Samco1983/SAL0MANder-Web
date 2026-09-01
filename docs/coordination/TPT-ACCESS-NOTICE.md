# TPT access notice — copy for every download

**Purpose.** A teacher in another district buys the resource, shares the link,
and the school network blocks it. Without a line telling them what to do, they
conclude the product is broken and leave a review saying so. With one, it
becomes a two-minute request to their technology office.

This is the difference between a refund and an approved domain.

## Constraints this copy is written under

**It sells nothing.** `TPT-RULES.md` records TPT's rule that a resource must not
drive buyers to an outside sales channel. This notice names a domain and a
privacy page — no store, no pricing, no subscription.

**Every claim is one the website can back.** "No advertising, no third-party
tracking, no required student accounts" is verifiable on
`sal0mander.com/privacy`. Nothing here claims COPPA, FERPA, or accessibility
conformance, because nothing establishes them and a district checks those first.

**It does not blame the school.** A technology office blocking an unknown domain
is doing its job. The wording assumes cooperation, not obstruction — the teacher
has to hand this to a colleague, and a resource that sounds aggrieved makes that
awkward.

---

## Short version — for a resource page or slide footer

> **School network access.** This activity uses **sal0mander.com**. If your
> school blocks it, ask your technology department to allow that one domain.

One line. Use where space is tight.

---

## Standard version — for every TPT download

> ### If your school network blocks the link
>
> This activity is hosted at **sal0mander.com**. Some school networks block
> websites they have not categorised yet, which is normal for newer sites and is
> not a problem with the activity.
>
> Ask your technology department to allow **sal0mander.com**. It is a single
> domain — there is nothing else to approve. It has no advertising, no
> third-party tracking, and students never create an account or sign in.
>
> Details they may want: **sal0mander.com/privacy**
>
> If they need anything further, they can write to **samco1983@gmail.com** and
> get a direct answer.

---

## Forwardable version — for the teacher to send to IT

Teachers should not have to compose this themselves. Include it so it can be
pasted straight into an email.

> Hello,
>
> I would like to use a classroom activity hosted at **sal0mander.com**, and it
> appears to be blocked on our network.
>
> - It is a single domain. No other hosts are contacted.
> - It has no advertising, analytics, or third-party tracking.
> - Students do not create accounts and are never asked for a name, email
>   address, or password.
> - Privacy and technical details: https://sal0mander.com/privacy
>
> Could this domain be allowed, or reviewed for categorisation as Education?
>
> Thank you.

---

## Placement

| Where | Which version |
| --- | --- |
| TPT product description | Short |
| First page of the PDF | Standard |
| Last page of the PDF | Forwardable |
| Beside the QR code | Short |

Put the standard version **before** the activity link, not after. A teacher who
hits a block has already stopped reading by the time they reach the back page.

## Maintenance

Two things make this copy false if they change, and both must be updated in the
same release:

1. **A second domain.** The notice says "a single domain" and that is currently
   exact — the production bundle contacts no external host. Adding a CDN, font
   service, or analytics endpoint breaks it.
2. **Student accounts.** "Students never create an account" is a
   CLAUDE.md non-negotiable, but a future teacher-account feature could blur it.

Re-read this file whenever either is proposed.
