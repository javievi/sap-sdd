---
name: sap-acceptance-criteria
description: "Draft or refine acceptance criteria for an SDD story"
disable-model-invocation: true
argument-hint: "Story ID, requirement, affected object/source, and expected observable results"
---
Draft or refine the acceptance criteria in the canonical
`specs/<story-id>.md` using verified requirements and source context. Use
observable GIVEN/WHEN/THEN outcomes and identify missing test data as a
blocker or unresolved input; do not claim that fixtures were looked up or
tests were executed unless there is evidence. Follow the SDD spec workflow and
do not change ABAP source unless implementation is explicitly requested and
its approval gates are met.