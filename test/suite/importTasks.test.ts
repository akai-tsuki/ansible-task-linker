import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('import_tasks / include_tasks', () => {
    let tmpDir: string;
    let taskFile: string;

    suiteSetup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ansible-test-'));
        const tasksDir = path.join(tmpDir, 'tasks');
        fs.mkdirSync(tasksDir);
        taskFile = path.join(tasksDir, 'setup.yml');
        fs.writeFileSync(taskFile, '---\n- name: setup\n  debug: msg=hello\n');
    });

    suiteTeardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    async function getLinks(content: string, fileName = 'playbook.yml'): Promise<vscode.DocumentLink[]> {
        const filePath = path.join(tmpDir, fileName);
        fs.writeFileSync(filePath, content);
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
            'vscode.executeLinkProvider', uri
        ) ?? [];
        return links;
    }

    test('basic import_tasks', async () => {
        const links = await getLinks('- import_tasks: tasks/setup.yml\n');
        assert.ok(links.length > 0, 'should have at least one link');
        const link = links[0];
        assert.ok(link.target, 'link should have target');
        assert.ok(link.target!.fsPath.endsWith('setup.yml'));
    });

    test('include_tasks', async () => {
        const links = await getLinks('- include_tasks: tasks/setup.yml\n');
        assert.ok(links.length > 0);
    });

    test('double-quoted path', async () => {
        const links = await getLinks('- import_tasks: "tasks/setup.yml"\n');
        assert.ok(links.length > 0);
        assert.ok(links[0].target);
    });

    test('single-quoted path', async () => {
        const links = await getLinks("- import_tasks: 'tasks/setup.yml'\n");
        assert.ok(links.length > 0);
        assert.ok(links[0].target);
    });

    test('indented directive', async () => {
        const links = await getLinks('  - import_tasks: tasks/setup.yml\n');
        assert.ok(links.length > 0);
    });

    test('non-existent file yields no target', async () => {
        const links = await getLinks('- import_tasks: tasks/missing.yml\n');
        const withTarget = links.filter(l => l.target);
        assert.strictEqual(withTarget.length, 0);
    });

    test('comment line skipped', async () => {
        const links = await getLinks('# - import_tasks: tasks/setup.yml\n');
        assert.strictEqual(links.length, 0);
    });

    test('jinja2 variable skipped', async () => {
        const links = await getLinks('- include_tasks: "{{ role_path }}/tasks/main.yml"\n');
        assert.strictEqual(links.length, 0);
    });
});
