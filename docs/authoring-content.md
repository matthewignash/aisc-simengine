# Authoring content

> **Status: stub.** This document will walk a teacher through creating a new topic.

The content authoring pipeline lands in step 8 of the broader build sequence. When complete, this guide will describe:

- The `topics/{syllabus-code}-{slug}/` directory layout (`meta.yml`, `index.md`, per-block content files, `images/`)
- Content variant frontmatter for the four `(language × level)` combinations: default/EAL × SL/HL
- How to declare prerequisites, syllabus codes, and license metadata
- The build step that turns markdown directives into static topic-page HTML
- Image manifest requirements (alt text, license, source — all mandatory)
- The originality check that runs against the Kognity/Pearson corpus

Until then, see the spec at `1-Projects/SimEngine/docs/specs/2026-04-29-gaslaws-polish-handoff.md` (§4) in the IB Chemistry project folder for the design intent.
