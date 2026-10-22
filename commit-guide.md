# Commit Guide

Use one focused commit for each logical change.

## Format

```text
<type>(<scope>): <short imperative summary>
```

## Types

- `feat`: add a new capability
- `fix`: correct a defect or inconsistency
- `docs`: change documentation only
- `refactor`: reorganize without changing behavior
- `chore`: repository maintenance

## Examples

```text
feat(agent): add ABAP analysis workflow
fix(gfgr): align companion program naming
docs(repo): add repository overview
chore(ignore): exclude local OS artifacts
```

Use lowercase scopes where useful, such as `agent`, `skills`, `policy`, `docs`,
or `repo`. Keep the summary concise, specific, and written in the imperative
mood.

## Major Updates

```
feat(agent)!: add new workflow agent
```
For breaking changes that need major attention, use `!` before colon to give emphasis.
