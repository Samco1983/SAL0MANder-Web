# Prompt — generating SAL0MANder puzzle art

Paste the template below into Antigravity (or any image generator). It is
written for the specific job: **a picture that gets cut into jigsaw pieces and
revealed one piece at a time as a student answers questions.**

That job has requirements ordinary illustration prompts do not.

---

## What we learned the hard way

**No text, ever.** The first Gemini batch put banners across the top —
"ROBOT AND ANIMAL HERO CITY 2024", "SCIENCE FAIR 2024". Two problems: a year
dates the artwork the moment it ships, and a puzzle piece containing half a
letter is much harder to place than a piece of sky or fur. One image had to be
cropped below the banner before it could be used.

**Detail must reach the edges.** A big empty sky or flat background makes those
pieces nearly identical, which is frustrating rather than challenging. Every
region of the frame needs something to recognise.

**One clear subject, not a crowd.** The reveal only lands if there is something
to reveal. A busy scene with no focal point reads as noise at 9 pieces.

**Aspect ratio has to match a board shape.** Unity supports Square, Portrait
and Landscape. Art at some other ratio gets letterboxed or cropped, and the
crop is not chosen by anyone who saw the picture.

---

## The template

Replace the bracketed parts. Everything else stays.

```
Create a [SQUARE 1:1 | PORTRAIT 3:4 | LANDSCAPE 16:9] illustration for a
children's educational jigsaw puzzle.

SUBJECT: [one clear main subject doing one clear thing — e.g. "a friendly
robot and a cat in spacesuits floating inside a space station, looking out a
round window at a colourful spiral galaxy"]

STYLE: warm, playful cartoon illustration with clean bold outlines and flat
saturated colour. Readable and high-contrast. Appealing to ages 10 to 16 —
friendly but not babyish. Consistent lighting, no photorealism.

COMPOSITION FOR A JIGSAW — this matters more than usual:
- One clear focal subject, large in frame, roughly centred.
- Visual interest across the ENTIRE frame including all four corners and
  every edge. No large areas of flat single colour, empty sky, or plain
  gradient — pieces cut from those are indistinguishable and frustrating.
- Distinct colour regions and recognisable shapes throughout, so any single
  piece has something identifiable on it.
- Rich background detail that supports the subject rather than competing
  with it.

HARD CONSTRAINTS:
- NO text, letters, numbers, words, signage, banners, or dates anywhere in
  the image. None. Not on signs, not on clothing, not in the background.
- No copyrighted or trademarked characters, logos, or brands.
- No real or photorealistic children, and no recognisable real people.
- Nothing frightening, violent, or gory.
- No watermarks or signatures.

OUTPUT: a single complete illustration filling the whole frame, edge to edge,
with no borders, no frames, and no margins.
```

---

## Subject ideas that work

Tested against the "does it make a good puzzle" bar — clear subject, detail
everywhere, no text needed:

- A cat in a spacesuit and a robot inside a space station, galaxy through the
  window *(already generated, in use)*
- A golden retriever in a superhero cape flying over a sunlit city
  *(already generated, in use)*
- A coral reef with fish, a sea turtle and a small submarine
- A dragon curled around a castle tower at sunset
- A treehouse village in a jungle canopy with parrots and monkeys
- A crystal cave with glowing formations and a small explorer
- A farmyard at golden hour with animals, a barn and a tractor
- A winter workshop with animals building toys
- A dinosaur in a go-kart on a futuristic racetrack *(already generated)*
- A greenhouse laboratory with plants, beakers and a curious fox

Themed sets are worth doing deliberately — a teacher choosing "ocean" for a
marine biology unit is a real use case.

---

## After generating

**Do not commit the originals.** They arrive around 3.5MB each. Optimise first:

```
python3 - <<'PY'
from PIL import Image
im = Image.open("SOURCE.jpeg")
im.thumbnail((1600, 1600), Image.LANCZOS)
im.convert("RGB").save("out.jpg", "JPEG", quality=82, optimize=True, progressive=True)
PY
```

That lands around 300KB with no visible loss at screen size.

**Where they go:**

| Use | Destination | Owner |
| --- | --- | --- |
| The puzzle students assemble | Unity `Assets/Sprites/` | **Codex / Unity** |
| Preview art on the website | `public/art/` | web |

Web can host a preview; only Unity can make something an actual puzzle. Ask
Codex what size and format they want before generating a large batch — every
image added to the WebGL build grows what a student downloads over school wifi,
and that build is already ~87MB.

**Check before shipping any image:**

1. No text anywhere, including small background details.
2. Interesting content in all four corners.
3. Still readable shrunk to thumbnail size.
4. Nothing that dates it — no years, no seasonal-only content unless intended.
5. Aspect ratio matches a board shape Unity supports.
