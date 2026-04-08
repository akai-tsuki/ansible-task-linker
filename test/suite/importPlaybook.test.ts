import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('import_playbook', () => {
    let tmpDir: string;

    suiteSetup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ansible-playbook-test-'));

        // site.yml alongside the playbook
        fs.writeFileSync(path.join(tmpDir, 'site.yml'), '---\n');

        // sub/deploy.yml in a subdirectory
        const subDir = path.join(tmpDir, 'sub');
        fs.mkdirSync(subDir);
        fs.writeFileSync(path.join(subDir, 'deploy.yml'), '---\n');
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

    test('basic import_playbook', async () => {
        const links = await getLinks('- import_playbook: site.yml\n');
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0, 'should have a resolved link');
        assert.ok(withTarget[0].target!.fsPath.endsWith('site.yml'));
    });

    test('import_playbook with relative path', async () => {
        const links = await getLinks('- import_playbook: sub/deploy.yml\n');
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
        assert.ok(withTarget[0].target!.fsPath.includes('deploy.yml'));
    });

    test('import_playbook double-quoted', async () => {
        const links = await getLinks('- import_playbook: "site.yml"\n');
        const withTarget = links.filter(l => l.target);
        assert.ok(withTarget.length > 0);
    });

    test('import_playbook non-existent file yields no target', async () => {
        const links = await getLinks('- import_playbook: missing.yml\n');
        const withTarget = links.filter(l => l.target);
        assert.strictEqual(withTarget.length, 0);
    });

    test('import_playbook jinja2 skipped', async () => {
        const links = await getLinks('- import_playbook: "{{ env }}/site.yml"\n');
        assert.strictEqual(links.length, 0);
    });
});
