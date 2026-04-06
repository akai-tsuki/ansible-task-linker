# Changelog

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
