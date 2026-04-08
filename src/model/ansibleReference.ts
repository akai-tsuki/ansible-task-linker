import * as vscode from 'vscode';

export type AnsibleReferenceKind =
    | 'include_tasks'
    | 'import_tasks'
    | 'import_playbook'
    | 'include_role'
    | 'import_role';

/**
 * A resolved reference extracted from an Ansible YAML document.
 *
 * For task / playbook directives:
 *   - `sourceRange` is the range of the file path value (quotes excluded)
 *   - `rawValue`    is the file path string
 *
 * For role directives:
 *   - `sourceRange` is the range of the role `name` value (quotes excluded)
 *   - `rawValue`    is the role name (same as `roleName`)
 *   - `roleName`    is the role name
 *   - `tasksFrom`   is the `tasks_from` value when specified
 */
export interface AnsibleReference {
    kind: AnsibleReferenceKind;
    sourceUri: vscode.Uri;
    /** Range of the clickable value text, with surrounding quotes excluded. */
    sourceRange: vscode.Range;
    /** Raw string value extracted from the YAML scalar. */
    rawValue: string;
    roleName?: string;
    tasksFrom?: string;
}
