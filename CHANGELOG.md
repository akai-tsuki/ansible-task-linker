# Changelog

## [0.1.2] - 2026-04-09

### Added
- YAML AST-based parsing (replaces regex) for robustness against quoted values and map-style directives
- `import_playbook` directive support with relative path resolution
- `tasks_from` parameter support for `include_role` / `import_role`
- Go to Definition (F12) via `DefinitionProvider` for all supported directives

### Changed
- Refactored into layered architecture: model / parser / resolver / provider
- `include_tasks` bare filename now also searches `tasks/<file>` (existing behaviour preserved)

## [0.1.0] - 2026-04-07

### Added
- DocumentLink support for `import_tasks` and `include_tasks` directives
- DocumentLink support for `import_role` and `include_role` directives
- Two-phase link resolution (provide range immediately, resolve target on hover)
- Support for single and double quoted paths
- Jinja2 template variable detection and skip
- Ansible Collection format detection and skip
- `.yaml` extension fallback for role main files
- Remote filesystem support via `vscode.workspace.fs.stat()`
