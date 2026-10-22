# Changelog

All notable changes to this repository are documented in this file.

The format uses the following sections when they contain entries:

- Added
- Fixed
- Changed
- Removed

## [Unreleased]

### Fixed

- Aligned the SDD skill and source-write ownership guidance with the included
  `sdd-architect` and `sdd-implementer` agents; removed invocations of absent
  enhancement, new-development, specialist, and CDS workflows.
- Removed the team-standards description's assumption of a bundled Clean ABAP
  skill; mandatory team naming rules still override generic guidance.

## [1.2.1] - 2026-10-19

### Fixed

- Corrected invalid YAML indentation in affected custom-agent tool lists.

### Changed

- Updated the architect agent’s invocation and tool configuration.

## [1.2.0] - 2026-10-19

### Added

- Added a shared GFCP/GFGR unit-code migration model and targeted QA coverage guidance.

### Changed

- Standardized acceptance criteria and GFGR QA deliverables as compact GIVEN/WHEN/THEN tables.
- Set `OUC` as the default SAP connection and clarified bounded read-only fixture lookup.

## [1.1.3] - 2026-10-12

### Changed

- Repository agents now use the chat-selected model instead of repository-pinned model profiles.

### Removed

- Removed the repository model-switcher and its profile-switching workflow.

## [1.1.2] - 2026-10-12

### Added

- Expanded the SAP orchestrator's available tools for repository workflows, testing, diagnostics, source edits, activation, and validation.

### Changed

- Clarified revision tracking for new reports and changes to existing non-CDS ABAP.

## [1.1.1] - 2026-10-09

### Changed

- GFGR QA now defaults to compact GIVEN/WHEN/THEN test plans; detailed reviews, steps, and traceability are opt-in.

## [1.1.0] - 2026-10-09

### Added

- Added reusable ABAP templates and revision-marking snippets.

### Changed

- Clarified repository-maintenance reporting and release classification.
- Updated agent documentation to reflect current roles.

## [1.0.0] - 2026-09-30

### Added

- Added independent GFGR QA review with manual GIVEN/WHEN/THEN cases and a dedicated prompt.
- Added an acceptance-criteria prompt and permission-gated, read-only fixture discovery for both QA workflows.

### Changed

- Direct ABAP agent workflows now require scope approval, activation, targeted validation, and code review before completion.
- Revised repository-agent model profiles and introduced explicit tool allowlists.
- OUC-to-ODC revision merges now use version-history preflight and preserve a single blank revision template.
- GFGR QA and acceptance criteria now present verified test parameters alongside each GIVEN/WHEN/THEN case.

### Fixed

- Corrected GFGR extension-program mappings and ABAP FS tool identifiers in workspace policy.

## [0.2.0] - 2026-09-29

### Added

- Added a read-only acceptance-criteria agent for concise, parameter-specific GIVEN/WHEN/THEN criteria in QA order.

## [0.1.0] - 2026-09-11

### Added

- Initial OOCLSAP GitHub Copilot configuration repository.
- Created SAP_AIAgents_Dev and SAP_AIAgents_Release branches.
- Contains all agents necessary for ABAP Agentic AI workflow development.
- Repository-maintenance agent for changelog updates and commit-message drafts.
