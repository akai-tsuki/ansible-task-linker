import * as vscode from 'vscode';

/**
 * Returns the filesystem path of the workspace folder that contains the given
 * document URI, or undefined when no workspace is open.
 */
export function getWorkspaceRoot(documentUri: vscode.Uri): string | undefined {
    return vscode.workspace.getWorkspaceFolder(documentUri)?.uri.fsPath;
}
