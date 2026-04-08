import * as vscode from 'vscode';
import * as path from 'path';

async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
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

    const direct = vscode.Uri.file(path.resolve(documentDir, filePath));
    if (await fileExists(direct)) {
        return direct;
    }

    if (!filePath.includes('/') && !filePath.includes('\\')) {
        const viaTasks = vscode.Uri.file(
            path.resolve(documentDir, 'tasks', filePath)
        );
        if (await fileExists(viaTasks)) {
            return viaTasks;
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
    const uri = vscode.Uri.file(path.resolve(documentDir, filePath));
    return (await fileExists(uri)) ? uri : undefined;
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
        const uri = vscode.Uri.file(path.join(tasksDir, name));
        if (await fileExists(uri)) {
            return uri;
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
