import * as vscode from 'vscode';
import { AnsibleReference } from '../model/ansibleReference';
import {
    resolveTaskPath,
    resolvePlaybookPath,
    resolveRolePath,
} from '../utils/pathUtils';

/**
 * Resolves an `AnsibleReference` to a concrete VS Code URI.
 *
 * Returns `undefined` when the referenced file cannot be found, so callers
 * can safely skip unresolvable references without throwing.
 */
export async function resolveAnsibleReference(
    ref: AnsibleReference
): Promise<vscode.Uri | undefined> {
    switch (ref.kind) {
        case 'include_tasks':
        case 'import_tasks':
            return resolveTaskPath(ref.sourceUri, ref.rawValue);

        case 'import_playbook':
            return resolvePlaybookPath(ref.sourceUri, ref.rawValue);

        case 'include_role':
        case 'import_role':
            return resolveRolePath(ref.sourceUri, ref.roleName!, ref.tasksFrom);

        default:
            return undefined;
    }
}
