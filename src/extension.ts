import * as vscode from 'vscode';
import { AnsibleDocumentLinkProvider } from './providers/ansibleDocumentLinkProvider';
import { AnsibleDefinitionProvider } from './providers/ansibleDefinitionProvider';

export function activate(context: vscode.ExtensionContext) {
    const yamlSelector = { language: 'yaml' };

    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider(
            yamlSelector,
            new AnsibleDocumentLinkProvider()
        ),
        vscode.languages.registerDefinitionProvider(
            yamlSelector,
            new AnsibleDefinitionProvider()
        )
    );
}

export function deactivate() {}
