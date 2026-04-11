import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { AnsibleReference, AnsibleReferenceKind } from '../model/ansibleReference';
import { getScalarContentRange, getStringValue, isDynamic } from './astUtils';

const TASK_DIRECTIVES = new Set<string>([
    'include_tasks',
    'import_tasks',
    'import_playbook',
]);

const ROLE_DIRECTIVES = new Set<string>([
    'include_role',
    'import_role',
]);

/**
 * Parses all Ansible references from a VS Code TextDocument using the YAML AST.
 *
 * Supported directives:
 *   - include_tasks / import_tasks  (scalar file path)
 *   - import_playbook               (scalar file path)
 *   - include_role  / import_role   (map with `name` and optional `tasks_from`)
 *   - vars_files                    (sequence of scalar file paths)
 *
 * Documents with hard YAML parse errors are skipped entirely.
 * Values containing Jinja2 expressions are silently ignored.
 */
export function parseAnsibleReferences(
    document: vscode.TextDocument
): AnsibleReference[] {
    const text = document.getText();
    const references: AnsibleReference[] = [];

    let docs: yaml.Document[];
    try {
        docs = yaml.parseAllDocuments(text);
    } catch {
        return references;
    }

    for (const doc of docs) {
        if (doc.errors && doc.errors.length > 0) {
            continue;
        }
        try {
            collectFromNode(doc.contents, document, references);
        } catch {
            // Swallow unexpected traversal errors — never crash the extension
        }
    }

    return references;
}

// ---------------------------------------------------------------------------
// Internal traversal
// ---------------------------------------------------------------------------

function collectFromNode(
    node: yaml.Node | null | undefined,
    document: vscode.TextDocument,
    out: AnsibleReference[]
): void {
    if (!node) {
        return;
    }
    if (yaml.isSeq(node)) {
        for (const item of node.items) {
            if (yaml.isNode(item)) {
                collectFromNode(item, document, out);
            }
        }
    } else if (yaml.isMap(node)) {
        collectFromMap(node, document, out);
    }
}

function collectFromMap(
    map: yaml.YAMLMap,
    document: vscode.TextDocument,
    out: AnsibleReference[]
): void {
    for (const pair of map.items) {
        if (!yaml.isScalar(pair.key) || typeof pair.key.value !== 'string') {
            continue;
        }

        const directive = pair.key.value;

        if (TASK_DIRECTIVES.has(directive)) {
            const ref = extractTaskReference(
                directive as AnsibleReferenceKind,
                pair.value,
                document
            );
            if (ref) {
                out.push(ref);
            }
        } else if (ROLE_DIRECTIVES.has(directive)) {
            const ref = extractRoleReference(
                directive as AnsibleReferenceKind,
                pair.value,
                document
            );
            if (ref) {
                out.push(ref);
            }
        } else if (directive === 'vars_files') {
            extractVarsFilesReferences(pair.value, document, out);
        } else {
            // Recurse into nested sequences/maps (e.g. play-level `tasks:` key)
            if (yaml.isNode(pair.value)) {
                collectFromNode(pair.value, document, out);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Reference extraction helpers
// ---------------------------------------------------------------------------

function extractTaskReference(
    kind: AnsibleReferenceKind,
    valueNode: unknown,
    document: vscode.TextDocument
): AnsibleReference | null {
    if (!yaml.isScalar(valueNode)) {
        return null;
    }

    const rawValue = getStringValue(valueNode)?.trim();
    if (!rawValue || isDynamic(rawValue)) {
        return null;
    }

    const sourceRange = getScalarContentRange(valueNode, document);
    if (!sourceRange) {
        return null;
    }

    return {
        kind,
        sourceUri: document.uri,
        sourceRange,
        rawValue,
    };
}

function extractVarsFilesReferences(
    valueNode: unknown,
    document: vscode.TextDocument,
    out: AnsibleReference[]
): void {
    if (!yaml.isSeq(valueNode)) {
        return;
    }
    for (const item of valueNode.items) {
        if (!yaml.isScalar(item)) {
            continue;
        }
        const ref = extractTaskReference('vars_files', item, document);
        if (ref) {
            out.push(ref);
        }
    }
}

function extractRoleReference(
    kind: AnsibleReferenceKind,
    valueNode: unknown,
    document: vscode.TextDocument
): AnsibleReference | null {
    if (!yaml.isMap(valueNode)) {
        return null;
    }

    // --- role name (required) ---
    const namePair = valueNode.items.find(
        (p) => yaml.isScalar(p.key) && p.key.value === 'name'
    );
    if (!namePair || !yaml.isScalar(namePair.value)) {
        return null;
    }

    const roleName = getStringValue(namePair.value)?.trim();
    if (!roleName || isDynamic(roleName)) {
        return null;
    }

    // Skip Ansible Collection role format (e.g. namespace.collection.role)
    if (roleName.includes('.')) {
        return null;
    }

    const sourceRange = getScalarContentRange(namePair.value, document);
    if (!sourceRange) {
        return null;
    }

    // --- tasks_from (optional) ---
    const tasksFromPair = valueNode.items.find(
        (p) => yaml.isScalar(p.key) && p.key.value === 'tasks_from'
    );
    let tasksFrom: string | undefined;
    if (tasksFromPair && yaml.isScalar(tasksFromPair.value)) {
        const v = getStringValue(tasksFromPair.value)?.trim();
        if (v && !isDynamic(v)) {
            tasksFrom = v;
        }
    }

    return {
        kind,
        sourceUri: document.uri,
        sourceRange,
        rawValue: roleName,
        roleName,
        tasksFrom,
    };
}
