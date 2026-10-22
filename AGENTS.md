# ABAP FS Workspace Policy

SAP objects in this workspace are exposed through the ABAP FS virtual
filesystem (`adt://`); they are not ordinary local files. Treat every tool
restriction below as a hard constraint.

## Forbidden for ABAP Objects

- NEVER use terminal file commands such as `ls`, `find`, `grep`, `cat`, `rm`,
  `mv`, `cp`, or `touch`.
- NEVER use native filesystem discovery such as `file_search`, `grep_search`,
  or `list_dir`.
- NEVER broaden an agent's tool allowlist to bypass these restrictions.

## Allowed Operations

- Read or change known files with `read_file`, `create_file`, and
  `replace_string_in_file`. Agent profiles may grant these through the `read`
  and `edit` aliases.
- Discover ABAP objects with
  `murbani.vscode-abap-remote-fs/abapfs_search_objects`, never with filesystem
  search.
- Activate with `murbani.vscode-abap-remote-fs/abapfs_activate_object`.
- Run ABAP Unit with `murbani.vscode-abap-remote-fs/abapfs_run_unit_tests`.
- Use other ABAP FS tools only when the active agent explicitly allowlists
  them for its specialist role.

For repository customization files under `.github/`, use only the allowed
file operations. Do not use ABAP object, SAP data, terminal, or native search
tools to inspect or modify customization files. Public vendor documentation
may be fetched when no private code, configuration, or SAP data is transmitted.
The customization architect may inspect ABAP FS documentation and subagent
status, but must obtain confirmation before changing models or enablement.

## Required Write Sequence

1. Lock an ABAP file before saving it, and wait one second between modifying
   and saving it.
2. Complete related include changes before activation when necessary.
3. Activate every changed object; a saved but inactive change is incomplete.
4. Run the narrowest relevant ABAP Unit or ATC validation after activation.
