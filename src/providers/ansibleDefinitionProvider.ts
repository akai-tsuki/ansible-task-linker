import * as vscode from 'vscode';
import { parseAnsibleReferences } from '../parser/parseAnsibleReferences';
import { resolveAnsibleReference } from '../resolver/resolveAnsibleReference';

/**
 * Provides "Go to Definition" (F12) for Ansible directive references in YAML
 * files.
 *
 * When the cursor is on a reference value (e.g. the file path in
 * `import_tasks: tasks/setup.yml`, or the role name in `name: common`),
 * activating Go to Definition navigates to the beginning of the resolved file.
 */
export class AnsibleDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Definition | undefined> {
        const references = parseAnsibleReferences(document);
        const ref = references.find((r) => r.sourceRange.contains(position));
        if (!ref) {
            return undefined;
        }

        const uri = await resolveAnsibleReference(ref);
        if (!uri) {
            return undefined;
        }

        return new vscode.Location(uri, new vscode.Position(0, 0));
    }
}
