# Ansible Task Linker

A VSCode extension that provides clickable navigation links and Go to Definition for Ansible Playbook directives.

## Features

- **`import_tasks` / `include_tasks`**: Click the file path to navigate to the referenced task file
- **`import_playbook`**: Click the file path to navigate to the referenced playbook file
- **`import_role` / `include_role`**: Click the role name to navigate to `roles/<name>/tasks/main.yml`
- **`tasks_from`**: When `tasks_from` is specified, the role link resolves to that task file instead of `main.yml`
- **`vars_files`**: Each entry in the list becomes a clickable link to the referenced variable file
- **Go to Definition** (F12): Works on all of the above — navigate to the referenced file without clicking

## Supported Syntax

```yaml
# Tasks
- import_tasks: tasks/setup.yml
- include_tasks: "tasks/deploy.yml"
- include_tasks: 'tasks/handlers.yml'

# Bare filename — resolved relative to tasks/ directory
- include_tasks: setup.yml

# Playbooks
- import_playbook: site.yml
- import_playbook: "../other/deploy.yml"

# Roles
- import_role:
    name: common

- include_role:
    name: webserver

# Role with tasks_from
- include_role:
    name: common
    tasks_from: install

# vars_files — each entry is clickable
- hosts: all
  vars_files:
    - vars/common.yml
    - "vars/secrets.yml"
```

## Limitations

- Jinja2 template variables in paths (e.g., `{{ role_path }}/tasks/main.yml`) are not resolved
- Ansible Collection role names (e.g., `namespace.collection.role`) are not resolved
- Workspace must be open for role link resolution
- `import_playbook` resolves relative to the current file only (no full Ansible search path)

## Requirements

- VSCode `^1.80.0`

## Extension Settings

No configuration required.
