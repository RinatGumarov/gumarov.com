# Landing audience review

Recorded **2026-08-15** against the unpublished `gumarov.com` landing. Reviews used the production prerender (`pnpm build` + preview) for both `/en/` and `/ru/`.

This document is the Task 12 record. It is not publication approval.

## Disposition key

- **Keep** — no code change.
- **Accepted** — copy or component changed after a failing test.
- **Publication gate** — must be resolved by Rinat before Task 14.

## Instagram visitor (five-second first viewport)

Warm traffic already knows the person. The first viewport must still answer: who, what kind of engineer, what caliber, how to continue.

| Finding                                                                                                                                                                                                                                                                 | Disposition |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Header identity `RG` / Rinat Gumarov is immediate.                                                                                                                                                                                                                      | Keep        |
| H1 states Senior Frontend Engineer in both locales before any project card.                                                                                                                                                                                             | Keep        |
| Caliber is implied by the role line and the work CTA, not by a named company in the first screen. TradingView appears after one scroll. For warm Instagram traffic this is acceptable; naming a current employer in the hero would add confidentiality risk.            | Keep        |
| Contact path is the in-hero “Get in touch” / “Связаться” jump to `#contact`. Telegram is not in the first viewport. For this audience the jump is enough; duplicating `@RinatGumarov` in the hero would compete with the heading.                                       | Keep        |
| Personal-strip photo frames were empty placeholders. Rinat approved three of his own photographs (surfing, skating, snowboarding) on 2026-08-15; no stock or generated images were used. Frame opacity was raised from `0.34` to `0.78` so the night skate frame reads. | Resolved    |

## Recruiter / HR

Scan for frontend-first fit, seniority, contradictions, and easy rejection.

| Finding                                                                                                                                                                        | Disposition                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title, eyebrow, and first three projects read as a senior frontend engineer in trading/fintech.                                                                                | Keep                                                                                                                                                       |
| No dates, so no contradictory tenure. No invented user/revenue metrics.                                                                                                        | Keep                                                                                                                                                       |
| Telegram `@RinatGumarov` and `hi@gumarov.com` are professional and consistent.                                                                                                 | Keep                                                                                                                                                       |
| Evercity advertised “Full stack” in the capability line and contribution. That is an avoidable rejection signal on a frontend-first page and fights the rest of the narrative. | **Accepted.** Capability chips and contribution now lead with frontend only. Tests: `src/content/content.test.ts`, `src/components/ProjectScene.test.tsx`. |
| SplitHub is an iOS product. The eyebrow is “Product ownership”, not “iOS engineer”, and it sits after two frontend case studies.                                               | Keep                                                                                                                                                       |
| Hero body mentions “products of my own” / “собственных продуктов”. That is ownership, not a founder-first rebrand, because the H1 remains Senior Frontend Engineer.            | Keep                                                                                                                                                       |

## CTO / technical decision-maker

Scan for depth, systems thinking, credible project claims, and interview risk.

| Finding                                                                                                                                                                                                              | Disposition                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| TradingView names Pine Editor and Strategy Tester without metrics, clients, or confidential internals. Interview probe remains “what did you actually own?” — the copy does not pretend to answer that with numbers. | Keep                                     |
| Stoic is specific: primary frontend, React, TypeScript, Next.js, from scratch.                                                                                                                                       | Keep                                     |
| SplitHub shows the ability to finish: product, UX, App Store. Useful ownership signal if it stays third, not the hero.                                                                                               | Keep                                     |
| Evercity was the weakest technical card because “full stack” diluted the frontend systems story. Narrowing it to frontend work on a sustainable-finance platform is more credible for this audience.                 | **Accepted** (same change as recruiter). |
| Principles cover architecture, product thinking, performance/interaction, and ownership. They match the four spec themes.                                                                                            | Keep                                     |
| Motion, cookieless analytics, and prerender are implementation, not claims on the page. Good.                                                                                                                        | Keep                                     |

## SplitHub-style business partner

Scan for taste, reliability, shipping through ambiguity, and a low-friction contact path.

| Finding                                                                                                                                | Disposition      |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Visual language is restrained (dark, grid, monogram, abstract project geometry). It does not look like a template or a pitch deck.     | Keep             |
| SplitHub card plus the E30 / small-apps personal line shows that unfinished ideas get shipped, without making the page a startup site. | Keep             |
| Telegram and email are both present, labeled, and repeated in the footer.                                                              | Keep             |
| Empty personal frames hurt taste more than they help. Do not invent photos.                                                            | Publication gate |
| Privacy line is honest about cookieless analytics.                                                                                     | Keep             |

## Accepted change

Evercity public copy, both locales:

- EN contribution: `Contributed frontend work on a sustainable-finance platform.`
- EN capabilities: `Frontend · Sustainable finance`
- RU contribution: `Участвовал во frontend-разработке платформы устойчивого финансирования.`
- RU capabilities: `Frontend · Устойчивое финансирование`

No other copy was changed in this review.

## Awaiting Rinat approval

Publication (Task 14) must not proceed until Rinat explicitly approves:

1. Complete English page at `/en/` and Russian page at `/ru/`.
2. Every public claim in `src/content/en.ts` and `src/content/ru.ts`, including the narrowed Evercity wording.
3. Hero portrait crop, and the three approved personal photographs with their crops and localized alt text. Two watermarked third-party drift photographs of the BMW E30 were deliberately excluded for lack of cleared redistribution rights; publishing them needs the photographers' permission.
4. Contact destinations `https://t.me/RinatGumarov` and `mailto:hi@gumarov.com`.

Until that approval exists, this review is recorded and the site stays unpublished.
