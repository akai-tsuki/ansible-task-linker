import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('import_role / include_role', () => {
    let tmpDir: string;

    suiteSetup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ansible-role-test-'));
        // Create roles/common/tasks/main.yml
        const commonTasksDir = path.join(tmpDir, 'roles', 'common', 'tasks');
        fs.mkdirSync(commonTasksDir, { recursive: true });
        fs.writeFileSync(path.join(commonTasksDir, 'main.yml'), '---\n');

        // Create roles/webserver/tasks/main.yaml (yaml extension)
        const webserverTasksDir = path.join(tmpDir, 'roles', 'webserver', 'tasks');
        fs.mkdirSync(webserverTasksDir, { recursive: true });
        fs.writeFileSync(path.join(webserverTasksDir, 'main.yaml'), '---\n');

        // Create roles/my-role/tasks/main.yml
        const myRoleTasksDir = path.join(tmpDir, 'roles', 'my-role', 'tasks');
        fs.mkdirSync(myRoleTasksDir, { recursive: true });
        fs.writeFileSync(path.join(myRoleTasksDir, 'main.yml'), '---\n');
    });

    suiteTeardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    async function getLinks(content: string): Promise<vscode.DocumentLink[]> {
        const filePath = path.join(tmpDir, 'playbook.yml');
        fs.writeFileSync(filePath, content);
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.openTextDocument(uri);
        const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
            'vscode.executeLinkProvider', uri
        ) ?? [];
        return links;
    }

    test('basic import_role', async () => {
        const links = await getLinks('- import_role:\n    name: common\n');
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
        assert.ok(withTarget[0].target!.fsPath.includes('common'));
    });

    test('include_role', async () => {
        const links = await getLinks('- include_role:\n    name: common\n');
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
    });

    test('yaml extension fallback', async () => {
        const links = await getLinks('- import_role:\n    name: webserver\n');
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
        assert.ok(withTarget[0].target!.fsPath.endsWith('main.yaml'));
    });

    test('missing role yields no target', async () => {
        const links = await getLinks('- import_role:\n    name: missing\n');
        const withTarget = links.filter(l => l.target);
        assert.strictEqual(withTarget.length, 0);
    });

    test('quoted role name', async () => {
        const links = await getLinks('- import_role:\n    name: "my-role"\n');
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
    });

    test('collection format skipped', async () => {
        const links = await getLinks('- import_role:\n    name: ns.col.role\n');
        assert.strictEqual(links.length, 0);
    });

    test('subsequent task name not confused with role name', async () => {
        const content = '- import_role:\n    tasks_from: pre\n- name: Run something\n';
        const links = await getLinks(content);
        // Should not create a link for "Run something"
        const withTarget = links.filter(l => l.target);
        assert.strictEqual(withTarget.length, 0);
    });
});
