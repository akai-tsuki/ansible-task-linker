# Ansible Task Linker

A VSCode extension that provides clickable navigation links for Ansible Playbook directives.

## Features

- **`import_tasks` / `include_tasks`**: Click the file path to navigate to the referenced task file
- **`import_role` / `include_role`**: Click the role name to navigate to `roles/<name>/tasks/main.yml`

## Supported Syntax

```yaml
# Tasks
- import_tasks: tasks/setup.yml
- include_tasks: "tasks/deploy.yml"
- include_tasks: 'tasks/handlers.yml'

# Roles
- import_role:
    name: common

- include_role:
    name: webserver
```

## Limitations

- Jinja2 template variables in paths (e.g., `{{ role_path }}/tasks/main.yml`) are not resolved
- Ansible Collection role names (e.g., `namespace.collection.role`) are not resolved
- Workspace must be open for role link resolution

## Requirements

- VSCode `^1.80.0`

## Extension Settings

No configuration required.
