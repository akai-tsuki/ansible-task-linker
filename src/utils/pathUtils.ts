import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

async function fileExists(fsPath: string): Promise<boolean> {
    try {
        await fs.promises.access(fsPath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Resolves an `include_tasks` / `import_tasks` file path relative to the
 * document's directory.
 *
 * Resolution order:
 *  1. Path as written, relative to document directory.
 *  2. If the path has no directory component, also try `tasks/<file>`.
 */
export async function resolveTaskPath(
    documentUri: vscode.Uri,
    filePath: string
): Promise<vscode.Uri | undefined> {
    const documentDir = path.dirname(documentUri.fsPath);

    const directPath = path.resolve(documentDir, filePath);
    if (await fileExists(directPath)) {
        return vscode.Uri.file(directPath);
    }

    if (!filePath.includes('/') && !filePath.includes('\\')) {
        const viaTasksPath = path.resolve(documentDir, 'tasks', filePath);
        if (await fileExists(viaTasksPath)) {
            return vscode.Uri.file(viaTasksPath);
        }
    }

    return undefined;
}

/**
 * Resolves an `import_playbook` file path relative to the document's directory.
 */
export async function resolvePlaybookPath(
    documentUri: vscode.Uri,
    filePath: string
): Promise<vscode.Uri | undefined> {
    const documentDir = path.dirname(documentUri.fsPath);
    const resolvedPath = path.resolve(documentDir, filePath);
    return (await fileExists(resolvedPath)) ? vscode.Uri.file(resolvedPath) : undefined;
}

/**
 * Resolves an `include_role` / `import_role` reference to a task file.
 *
 * Resolution order when `tasksFrom` is specified:
 *  1. `roles/<roleName>/tasks/<tasksFrom>` (if `tasksFrom` already has .yml/.yaml extension)
 *  2. `roles/<roleName>/tasks/<tasksFrom>.yml`
 *  3. `roles/<roleName>/tasks/<tasksFrom>.yaml`
 *
 * When `tasksFrom` is not specified, the default entry point:
 *  1. `roles/<roleName>/tasks/main.yml`
 *  2. `roles/<roleName>/tasks/main.yaml`
 *
 * Role resolution is always anchored to the workspace folder that contains the
 * document.
 */
export async function resolveRolePath(
    documentUri: vscode.Uri,
    roleName: string,
    tasksFrom?: string
): Promise<vscode.Uri | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
    if (!workspaceFolder) {
        return undefined;
    }

    const tasksDir = path.join(
        workspaceFolder.uri.fsPath,
        'roles',
        roleName,
        'tasks'
    );

    const candidates: string[] = tasksFrom
        ? buildTasksFromCandidates(tasksFrom)
        : ['main.yml', 'main.yaml'];

    for (const name of candidates) {
        const resolvedPath = path.join(tasksDir, name);
        if (await fileExists(resolvedPath)) {
            return vscode.Uri.file(resolvedPath);
        }
    }

    return undefined;
}

function buildTasksFromCandidates(tasksFrom: string): string[] {
    if (/\.ya?ml$/.test(tasksFrom)) {
        return [tasksFrom];
    }
    return [`${tasksFrom}.yml`, `${tasksFrom}.yaml`];
}
