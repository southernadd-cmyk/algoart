# Confluence — design direction (draft, not for live navigation)

Confluence is the independent three-artist editor within PROPORTION PIECE.

## Design 1 — standalone editor
Use the user's supplied full desktop editor reference as the UI direction:
- Quiet, pale editorial treatment matched to the main PROPORTION PIECE editor.
- Large shared drawing board as the centre of attention.
- Three artist cards: a lead drawing, a reply, and a minor/counterpoint.
- Artist-specific system, palette and material, with responsive controls, replay, step, finish, PNG and turn log.
- Three artists only; initial φ turn shares approximately 50%, 31%, 19%.
- Main title **Confluence**. Introductory line: "Several systems, one sheet. Each answers what the others leave."

## Design 2 — handoff card
Use the user's second supplied reference as the future main editor handoff, **not** as an alternative editor UI.
- Heading: **Draw this with others**
- Explanatory text: "Your drawing becomes the lead. Two more systems take turns answering it on the same sheet."
- Action: **Open in Confluence ↗**
- Supporting line: "The current drawing's seed, settings and material come with it."
- Preserve current artwork state in a deep link; Artist 1 is the lead, and Artists 2–3 respond.

## Release boundary
**Do not link to Confluence from the live editor, navbar or About page yet.**
Keep PR in draft until UI, import fidelity, mobile layout, material rendering and replay are verified.
Working path proposed: /confluence/. Historical /collab/ and /about/collab-lab/ should redirect with query parameters preserved.
