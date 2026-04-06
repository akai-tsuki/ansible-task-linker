import * as vscode from 'vscode';
import * as path from 'path';
import { resolveTaskPath, resolveRolePath } from '../utils/pathResolver';

const TASKS_PATTERN = /^[ \t]*-?[ \t]*(import_tasks|include_tasks):[ \t]*['"]?([^'"{\s][^\s'"]*\.ya?ml)['"]?[ \t]*$/gm;
const ROLE_PATTERN = /(import_role|include_role):[ \t]*\n(?:[ \t]+(?!name:[ \t])\S[^\n]*\n)*[ \t]+name:[ \t]*['"]?(\S+?)['"]?[ \t]*$/gm;

interface PendingLink {
    type: 'task' | 'role';
    value: string;
    documentUri: vscode.Uri;
}

export class AnsibleLinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        const links: vscode.DocumentLink[] = [];
        const text = document.getText();

        // import_tasks / include_tasks
        TASKS_PATTERN.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = TASKS_PATTERN.exec(text)) !== null) {
            const filePath = match[2];
            const matchStart = match.index + match[0].indexOf(filePath);
            const range = new vscode.Range(
                document.positionAt(matchStart),
                document.positionAt(matchStart + filePath.length)
            );
            const link = new vscode.DocumentLink(range);
            (link as any)._pending = {
                type: 'task',
                value: filePath,
                documentUri: document.uri,
            } as PendingLink;
            links.push(link);
        }

        // import_role / include_role
        ROLE_PATTERN.lastIndex = 0;
        while ((match = ROLE_PATTERN.exec(text)) !== null) {
            const roleName = match[2];
            // Skip Ansible Collection format (contains dots)
            if (roleName.includes('.')) {
                continue;
            }
            // Find the position of roleName in the matched string
            const matchedText = match[0];
            const roleNameIndexInMatch = matchedText.lastIndexOf(roleName);
            const matchStart = match.index + roleNameIndexInMatch;
            const range = new vscode.Range(
                document.positionAt(matchStart),
                document.positionAt(matchStart + roleName.length)
            );
            const link = new vscode.DocumentLink(range);
            (link as any)._pending = {
                type: 'role',
                value: roleName,
                documentUri: document.uri,
            } as PendingLink;
            links.push(link);
        }

        return links;
    }

    async resolveDocumentLink(link: vscode.DocumentLink): Promise<vscode.DocumentLink> {
        const pending = (link as any)._pending as PendingLink | undefined;
        if (!pending) {
            return link;
        }

        let resolvedUri: vscode.Uri | undefined;

        if (pending.type === 'task') {
            resolvedUri = await resolveTaskPath(pending.documentUri, pending.value);
        } else if (pending.type === 'role') {
            resolvedUri = await resolveRolePath(pending.documentUri, pending.value);
        }

        if (resolvedUri) {
            link.target = resolvedUri;
            link.tooltip = resolvedUri.fsPath;
        }

        return link;
    }
}
