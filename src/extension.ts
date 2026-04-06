import * as vscode from 'vscode';
import { AnsibleLinkProvider } from './providers/ansibleLinkProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new AnsibleLinkProvider();
    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider(
            { language: 'yaml' },
            provider
        )
    );
}

export function deactivate() {}
