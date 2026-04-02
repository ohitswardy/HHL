# Installed Claude Code Skills

> All skills are installed in `.claude/skills/` and are automatically available to Claude Code.

---

## 1. Frontend Design

- **Source:** [github.com/anthropics/claude-code/tree/main/plugins/frontend-design](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design)
- **Path:** `.claude/skills/frontend-design/`
- **Authors:** Prithvi Rajasekaran, Alexander Bricken (Anthropic)

### What it does
Generates distinctive, production-grade frontend interfaces with high design quality. Automatically activates when building web components, pages, or applications. Avoids generic AI aesthetics by making bold choices in typography, color palettes, animations, and visual details.

### Usage
Describe your frontend needs naturally:
```
"Create a dashboard for a music streaming app"
"Build a landing page for an AI security startup"
"Design a settings panel with dark mode"
```

---

## 2. UI UX Pro Max

- **Source:** [github.com/nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- **Path:** `.claude/skills/ui-ux-pro-max/` (+ sub-skills: `banner-design/`, `brand/`, `design/`, `design-system/`, `slides/`, `ui-styling/`)

### What it does
Provides design intelligence for building professional UI/UX across multiple platforms and frameworks. Generates complete design systems from 67 UI styles, 161 color palettes, 57 font pairings, and 161 industry-specific reasoning rules.

### Sub-skills included
| Skill | Path |
|---|---|
| UI UX Pro Max (core) | `.claude/skills/ui-ux-pro-max/` |
| Banner Design | `.claude/skills/banner-design/` |
| Brand | `.claude/skills/brand/` |
| Design | `.claude/skills/design/` |
| Design System | `.claude/skills/design-system/` |
| Slides | `.claude/skills/slides/` |
| UI Styling | `.claude/skills/ui-styling/` |

### Usage
```
"Design a complete design system for my SaaS app"
"Create a landing page with a modern aesthetic"
"Build a brand identity for a fintech startup"
```

---

## 3. Claude SEO

- **Source:** [github.com/AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo)
- **Path:** `.claude/skills/seo/` (+ 18 sub-skills and 12 subagents)

### What it does
Comprehensive SEO toolkit with 19 sub-skills, 12 subagents, and 3 extensions. Performs SEO audits, technical analysis, content optimization (E-E-A-T), schema markup generation, and AI search optimization.

### Sub-skills installed
| Skill | Path |
|---|---|
| SEO (core) | `.claude/skills/seo/` |
| SEO Audit | `.claude/skills/seo-audit/` |
| SEO Backlinks | `.claude/skills/seo-backlinks/` |
| SEO Competitor Pages | `.claude/skills/seo-competitor-pages/` |
| SEO Content | `.claude/skills/seo-content/` |
| SEO DataForSEO | `.claude/skills/seo-dataforseo/` |
| SEO Geo | `.claude/skills/seo-geo/` |
| SEO Google | `.claude/skills/seo-google/` |
| SEO Hreflang | `.claude/skills/seo-hreflang/` |
| SEO Image Gen | `.claude/skills/seo-image-gen/` |
| SEO Images | `.claude/skills/seo-images/` |
| SEO Local | `.claude/skills/seo-local/` |
| SEO Maps | `.claude/skills/seo-maps/` |
| SEO Page | `.claude/skills/seo-page/` |
| SEO Plan | `.claude/skills/seo-plan/` |
| SEO Programmatic | `.claude/skills/seo-programmatic/` |
| SEO Schema | `.claude/skills/seo-schema/` |
| SEO Sitemap | `.claude/skills/seo-sitemap/` |
| SEO Technical | `.claude/skills/seo-technical/` |

### Subagents
Installed at `.claude/skills/claude-seo-agents/` (12 agents for content, DataForSEO, geo, Google, image gen, local, maps, performance, schema, sitemap, technical, visual).

### Key commands
```
/seo audit <url>       - Full website audit
/seo page <url>        - Single-page analysis
/seo schema <url>      - Detect and validate markup
/seo technical <url>   - 9-category technical audit
/seo google [command]  - Google APIs (GSC, PageSpeed, CrUX, GA4)
```

### Requirements
- Python 3.10+
- Optional: Playwright (screenshots), Google API credentials

---

## 4. Code Review Skill

- **Source:** [github.com/awesome-skills/code-review-skill](https://github.com/awesome-skills/code-review-skill)
- **Path:** `.claude/skills/code-review-skill/`

### What it does
Production-ready code review skill covering 11+ programming languages with over 9,500 lines of review guidelines. Uses progressive loading (core ~190 lines, language guides on-demand) and a four-phase review process.

### Review process
1. **Context gathering** - understand scope and intent
2. **High-level review** - architecture and design patterns
3. **Line-by-line analysis** - detailed code inspection
4. **Summary** - findings with severity labels

### Severity labels
`blocking` | `important` | `nit` | `suggestion` | `learning` | `praise`

### Supported languages
- **Frontend:** React 19, Vue 3.5, TypeScript, CSS/Sass
- **Backend:** Java 17/21, Python, Go, Rust
- **Systems:** C, C++, Qt Framework
- **Cross-cutting:** Architecture & Performance reviews

### Usage
```
"Use code-review-skill to review this PR"
"Review the changes in src/auth/ for security issues"
```

---

## 5. Remotion Skills

- **Source:** [remotion.dev/docs/ai/skills](https://remotion.dev/docs/ai/skills)
- **Path:** `.claude/skills/remotion/`

### What it does
Defines best practices for working within Remotion projects. Helps Claude Code understand Remotion conventions for programmatic video creation including 3D, animations, assets, audio, audio visualization, and more.

### Rules included
Located in `.claude/skills/remotion/rules/`:
- 3D rendering
- Animations
- Assets management
- Audio
- Audio visualization
- And more...

### Usage
```
"Create a Remotion video composition with animated text"
"Add audio visualization to my Remotion project"
```

---

## 6. OWASP Security

- **Source:** [github.com/agamm/claude-code-owasp](https://github.com/agamm/claude-code-owasp)
- **Path:** `.claude/skills/owasp-security/`
- **License:** MIT

### What it does
Security-focused skill that automatically activates when examining code for vulnerabilities, designing auth systems, processing user input, implementing encryption, creating API endpoints, or developing AI agent systems.

### Included resources
- **OWASP Top 10:2025** reference materials
- **OWASP Agentic AI Security (2026)** guidance
- **ASVS 5.0** verification requirements
- Security review checklists (input validation, authentication, access control, data protection, error handling)
- Secure vs. unsafe coding examples
- Language-specific security considerations for 20+ languages

### Auto-activates when
- Reviewing code for security flaws
- Designing authentication/authorization systems
- Processing user-supplied input or external data
- Implementing encryption or password handling
- Creating API endpoints
- Developing AI agent systems

---

## Summary

| # | Skill | Skills Count | Path |
|---|---|---|---|
| 1 | Frontend Design | 1 | `.claude/skills/frontend-design/` |
| 2 | UI UX Pro Max | 7 (core + 6 sub-skills) | `.claude/skills/ui-ux-pro-max/` |
| 3 | Claude SEO | 19 skills + 12 agents | `.claude/skills/seo/` |
| 4 | Code Review | 1 (+ 11 language guides) | `.claude/skills/code-review-skill/` |
| 5 | Remotion | 1 (+ rule files) | `.claude/skills/remotion/` |
| 6 | OWASP Security | 1 | `.claude/skills/owasp-security/` |

**Total:** 31 skill directories installed in `.claude/skills/`
