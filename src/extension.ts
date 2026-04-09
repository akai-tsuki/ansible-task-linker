import * as vscode from 'vscode';
import { AnsibleDocumentLinkProvider } from './providers/ansibleDocumentLinkProvider';
import { AnsibleDefinitionProvider } from './providers/ansibleDefinitionProvider';

export function activate(context: vscode.ExtensionContext) {
    // Register for both 'yaml' and 'ansible' language IDs.
    // The Red Hat Ansible extension (ansible.vscode-ansible) assigns the
    // language ID 'ansible' to playbook files, so we must cover both.
    const selectors: vscode.DocumentSelector = [
        { language: 'yaml' },
        { language: 'ansible' },
    ];

    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider(
            selectors,
            new AnsibleDocumentLinkProvider()
        ),
        vscode.languages.registerDefinitionProvider(
            selectors,
            new AnsibleDefinitionProvider()
        )
    );
}

export function deactivate() {}
