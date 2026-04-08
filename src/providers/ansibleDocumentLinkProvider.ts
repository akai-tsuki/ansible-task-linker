import * as vscode from 'vscode';
import { parseAnsibleReferences } from '../parser/parseAnsibleReferences';
import { resolveAnsibleReference } from '../resolver/resolveAnsibleReference';
import { AnsibleReference } from '../model/ansibleReference';

// Symbol used to stash the parsed reference on each DocumentLink so that
// resolveDocumentLink can retrieve it without re-parsing the document.
const REF_KEY = Symbol('ansibleRef');

interface AnnotatedLink extends vscode.DocumentLink {
    [REF_KEY]?: AnsibleReference;
}

/**
 * Provides clickable document links for Ansible directives in YAML files.
 *
 * Uses a two-phase approach:
 *  - `provideDocumentLinks` parses the YAML AST synchronously and returns
 *    link ranges immediately (no filesystem access).
 *  - `resolveDocumentLink` resolves each link's target asynchronously when the
 *    user hovers or activates it.
 */
export class AnsibleDocumentLinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(
        document: vscode.TextDocument
    ): vscode.DocumentLink[] {
        const references = parseAnsibleReferences(document);
        return references.map((ref) => {
            const link: AnnotatedLink = new vscode.DocumentLink(ref.sourceRange);
            link[REF_KEY] = ref;
            return link;
        });
    }

    async resolveDocumentLink(
        link: vscode.DocumentLink
    ): Promise<vscode.DocumentLink> {
        const ref = (link as AnnotatedLink)[REF_KEY];
        if (!ref) {
            return link;
        }

        const uri = await resolveAnsibleReference(ref);
        if (uri) {
            link.target  = uri;
            link.tooltip = uri.fsPath;
        }

        return link;
    }
}
