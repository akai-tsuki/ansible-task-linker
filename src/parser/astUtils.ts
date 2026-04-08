import * as vscode from 'vscode';
import { Scalar } from 'yaml';

/**
 * Returns the content range of a YAML scalar, with surrounding quote characters excluded.
 *
 * yaml package encodes `range` as `[start, end, nodeEnd]` where:
 *   - For PLAIN scalars: start/end are the content boundaries.
 *   - For QUOTE_SINGLE / QUOTE_DOUBLE: start points to the opening quote and
 *     end points to the position after the closing quote.
 *
 * We strip one character from each side for quoted scalars so the VS Code range
 * covers only the string content itself.
 */
export function getScalarContentRange(
    scalar: Scalar,
    document: vscode.TextDocument
): vscode.Range | null {
    if (!scalar.range || scalar.range.length < 2) {
        return null;
    }

    const [start, end] = scalar.range;
    const isQuoted =
        scalar.type === 'QUOTE_SINGLE' || scalar.type === 'QUOTE_DOUBLE';

    const contentStart = isQuoted ? start + 1 : start;
    const contentEnd   = isQuoted ? end   - 1 : end;

    if (contentStart >= contentEnd) {
        return null;
    }

    return new vscode.Range(
        document.positionAt(contentStart),
        document.positionAt(contentEnd)
    );
}

/**
 * Returns the string value of a YAML Scalar node, or null if the node is not a
 * string scalar (e.g. number, boolean, null, or not a Scalar at all).
 */
export function getStringValue(node: unknown): string | null {
    if (node instanceof Scalar && typeof node.value === 'string') {
        return node.value;
    }
    return null;
}

/**
 * Returns true if the value contains a Jinja2 expression (`{{ }}` or `{% %}`).
 * Such values are dynamic and cannot be statically resolved.
 */
export function isDynamic(value: string): boolean {
    return /\{\{.*?\}\}|\{%.*?%\}/.test(value);
}
