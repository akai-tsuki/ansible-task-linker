import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('tasks_from', () => {
    let tmpDir: string;

    suiteSetup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ansible-tasksfrom-test-'));

        // roles/myrole/tasks/main.yml
        const mainTasksDir = path.join(tmpDir, 'roles', 'myrole', 'tasks');
        fs.mkdirSync(mainTasksDir, { recursive: true });
        fs.writeFileSync(path.join(mainTasksDir, 'main.yml'), '---\n');
        fs.writeFileSync(path.join(mainTasksDir, 'install.yml'), '---\n');
        fs.writeFileSync(path.join(mainTasksDir, 'config.yaml'), '---\n');

        // roles/yamlrole/tasks/main.yaml (.yaml extension only)
        const yamlRoleTasksDir = path.join(tmpDir, 'roles', 'yamlrole', 'tasks');
        fs.mkdirSync(yamlRoleTasksDir, { recursive: true });
        fs.writeFileSync(path.join(yamlRoleTasksDir, 'main.yaml'), '---\n');
        fs.writeFileSync(path.join(yamlRoleTasksDir, 'setup.yaml'), '---\n');
    });

    suiteTeardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    async function getLinks(content: string): Promise<vscode.DocumentLink[]> {
        const filePath = path.join(tmpDir, 'playbook.yml');
        fs.writeFileSync(filePath, content);
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.openTextDocument(uri);
        return await vscode.commands.executeCommand<vscode.DocumentLink[]>(
            'vscode.executeLinkProvider', uri
        ) ?? [];
    }

    test('role without tasks_from resolves to main.yml', async () => {
        const links = await getLinks(
            '- include_role:\n    name: myrole\n'
        );
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
        assert.ok(withTarget[0].target!.fsPath.endsWith('main.yml'));
    });

    test('tasks_from resolves to named file (.yml)', async () => {
        const links = await getLinks(
            '- include_role:\n    name: myrole\n    tasks_from: install\n'
        );
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
        assert.ok(withTarget[0].target!.fsPath.endsWith('install.yml'));
    });

    test('tasks_from resolves to named file (.yaml extension)', async () => {
        const links = await getLinks(
            '- include_role:\n    name: myrole\n    tasks_from: config\n'
        );
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
        assert.ok(withTarget[0].target!.fsPath.endsWith('config.yaml'));
    });

    test('tasks_from with import_role', async () => {
        const links = await getLinks(
            '- import_role:\n    name: myrole\n    tasks_from: install\n'
        );
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
        assert.ok(withTarget[0].target!.fsPath.endsWith('install.yml'));
    });

    test('role with .yaml main fallback and tasks_from', async () => {
        const links = await getLinks(
            '- include_role:\n    name: yamlrole\n    tasks_from: setup\n'
        );
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
        assert.ok(withTarget[0].target!.fsPath.endsWith('setup.yaml'));
    });

    test('tasks_from non-existent file yields no target', async () => {
        const links = await getLinks(
            '- include_role:\n    name: myrole\n    tasks_from: missing\n'
        );
        const withTarget = links.filter(l => l.target);
        assert.strictEqual(withTarget.length, 0);
    });

    test('tasks_from jinja2 value falls back to main.yml', async () => {
        // Dynamic tasks_from is skipped; role name is still linked to main.yml
        const links = await getLinks(
            '- include_role:\n    name: myrole\n    tasks_from: "{{ var }}"\n'
        );
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
        assert.ok(withTarget[0].target!.fsPath.endsWith('main.yml'));
    });
});
