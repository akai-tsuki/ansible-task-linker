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

export async function resolveTaskPath(
    documentUri: vscode.Uri,
    filePath: string
): Promise<vscode.Uri | undefined> {
    const documentDir = path.dirname(documentUri.fsPath);
    const resolved = path.resolve(documentDir, filePath);
    const uri = vscode.Uri.file(resolved);
    if (await fileExists(uri)) {
        return uri;
    }
    return undefined;
}

export async function resolveRolePath(
    documentUri: vscode.Uri,
    roleName: string
): Promise<vscode.Uri | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
    if (!workspaceFolder) {
        return undefined;
    }
    const workspaceRoot = workspaceFolder.uri.fsPath;

    const ymlPath = path.join(workspaceRoot, 'roles', roleName, 'tasks', 'main.yml');
    const ymlUri = vscode.Uri.file(ymlPath);
    if (await fileExists(ymlUri)) {
        return ymlUri;
    }

    const yamlPath = path.join(workspaceRoot, 'roles', roleName, 'tasks', 'main.yaml');
    const yamlUri = vscode.Uri.file(yamlPath);
    if (await fileExists(yamlUri)) {
        return yamlUri;
    }

    return undefined;
}
