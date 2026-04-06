# VSCode拡張機能 仕様書
# Ansible Task Linker

## 1. 概要

### 1.1 プロジェクト名
`ansible-task-linker`

### 1.2 目的
Ansible Playbookの開発効率を向上させるため、YAMLファイル内の`import_tasks`・`include_tasks`・`import_role`・`include_role`ディレクティブに対して、参照先ファイルへのナビゲーション機能を提供するVSCode拡張機能を開発する。

### 1.3 対象ユーザー
Ansible Playbookを日常的に開発・保守するエンジニア

---

## 2. 機能要件

### 2.1 DocumentLink機能（クリックでファイルを開く）

YAMLファイル内の該当ディレクティブの値部分をクリック可能なリンクとして表示し、対応するファイルを開く。

#### 2.1.1 import_tasks / include_tasks

| 項目 | 内容 |
|------|------|
| 対象ディレクティブ | `import_tasks`, `include_tasks` |
| リンク対象 | ディレクティブの値に記述されたファイルパス |
| パス解決方法 | 現在開いているYAMLファイルからの**相対パス**で解決 |
| リンク表示範囲 | ファイルパス文字列の部分のみ（クォートは除く） |
| ファイルが存在しない場合 | リンクを表示しない |
| ワークスペース未設定の場合 | 文書相対パスで解決するため、スキップしない |

**対応するYAML記法:**

```yaml
# インラインスタイル
- import_tasks: tasks/setup.yml
- include_tasks: tasks/deploy.yml

# クォートあり（シングル・ダブル両対応）
- import_tasks: "tasks/setup.yml"
- include_tasks: 'tasks/deploy.yml'

# モジュールスタイル（将来対応）
- import_tasks:
    file: tasks/setup.yml
```

**非対応（スキップするケース）:**

```yaml
# Jinja2テンプレート変数を含むパスは静的解決不可のためスキップ
- include_tasks: "{{ role_path }}/tasks/setup.yml"
- include_tasks: "tasks/{{ environment }}.yml"
```

#### 2.1.2 import_role / include_role

| 項目 | 内容 |
|------|------|
| 対象ディレクティブ | `import_role`, `include_role` |
| リンク対象 | `name:` パラメータに記述されたRole名 |
| 解決先ファイル | `{workspaceRoot}/roles/{role_name}/tasks/main.yml` |
| 拡張子フォールバック | `.yml` が存在しない場合 `.yaml` を試みる |
| リンク表示範囲 | Role名文字列の部分のみ（クォートは除く） |
| ファイルが存在しない場合 | リンクを表示しない |
| ワークスペース未設定の場合 | リンク解決をスキップする |

**対応するYAML記法:**

```yaml
# ブロックスタイル（name が次行）
- import_role:
    name: common

- include_role:
    name: webserver

# name と other パラメータが混在するケース（name: 以外の行をまたいでも動作）
- import_role:
    vars:
      key: value
    name: common

# name と同行スタイル（将来対応）
- import_role: { name: common }
```

**制限事項:**

```yaml
# Ansible Collection形式のRole名は解決不可（roles/ 配下に存在しないため）
# namespace.collection.role_name → ~/.ansible/collections/... を参照するが非対応
- import_role:
    name: namespace.collection.role_name  # リンクなし
```

---

### 2.2 対象ファイル

| 項目 | 内容 |
|------|------|
| 対象言語ID | `yaml` |
| 対象拡張子 | `.yml`, `.yaml` |
| 除外ファイル | なし（全YAMLファイルを対象とする） |

---

## 3. 非機能要件

### 3.1 パフォーマンス
- `provideDocumentLinks` はrangeのみを返し、ファイル存在確認は `resolveDocumentLink` で遅延実行する（2フェーズパターン）
- これにより、ユーザーがリンクにホバーするまでファイルシステムへのアクセスを行わない

### 3.2 エラーハンドリング
- 参照先ファイルが存在しない場合はリンクを表示しないが、エラーメッセージは表示しない
- ワークスペースが未設定の場合は `import_role` / `include_role` のリンク解決をスキップする（`import_tasks` / `include_tasks` はスキップしない）

### 3.3 互換性
- VSCode バージョン: `^1.80.0` 以上
- Node.js: `18.x` 以上
- 対象OS: Windows / macOS / Linux / Remote SSH / Codespaces / WSL

### 3.4 リモート開発環境への対応
- ファイル存在確認には `fs.existsSync()` を使わず、`vscode.workspace.fs.stat()` を使用する
- これにより Remote SSH・GitHub Codespaces・WSL 等の仮想ファイルシステム環境でも動作する

---

## 4. 技術仕様

### 4.1 使用するVSCode API

| API | 用途 |
|-----|------|
| `vscode.languages.registerDocumentLinkProvider` | DocumentLinkProviderの登録 |
| `vscode.DocumentLinkProvider` | リンクプロバイダーのインターフェース |
| `vscode.DocumentLink` | リンクオブジェクトの生成 |
| `vscode.DocumentLink.tooltip` | ホバー時に解決済み絶対パスを表示 |
| `vscode.Range` | リンク表示範囲の指定 |
| `vscode.Uri.file()` | ファイルURIの生成 |
| `vscode.workspace.getWorkspaceFolder()` | ワークスペースルートの取得 |
| `vscode.workspace.fs.stat()` | ファイル存在確認（仮想FSに対応、非同期） |
| `document.getText()` | ドキュメント全体テキストの取得 |
| `document.positionAt(offset)` | 文字オフセットを `vscode.Position` に変換（Range生成に必要） |

**Range生成の実装例:**

```typescript
const text = document.getText();
// ... regex match ...
const startOffset = match.index! + match[0].indexOf(matchedPath);
const endOffset = startOffset + matchedPath.length;
const range = new vscode.Range(
    document.positionAt(startOffset),
    document.positionAt(endOffset)
);
```

### 4.2 ファイル構成

```
ansible-task-linker/
├── src/
│   ├── extension.ts              # エントリーポイント（activate/deactivate）
│   ├── providers/
│   │   └── ansibleLinkProvider.ts  # DocumentLinkProviderの実装
│   └── utils/
│       └── pathResolver.ts       # パス解決ユーティリティ
├── test/
│   ├── suite/
│   │   ├── index.ts              # Mochaテストランナー設定
│   │   ├── importTasks.test.ts   # import_tasks / include_tasks テスト
│   │   └── importRole.test.ts    # import_role / include_role テスト
│   └── runTests.ts               # @vscode/test-electron エントリーポイント
├── .vscode/
│   ├── launch.json               # F5デバッグ設定
│   └── tasks.json                # ビルドタスク設定
├── package.json                  # 拡張機能マニフェスト
├── tsconfig.json
├── .vscodeignore
├── .gitignore
├── CHANGELOG.md
└── README.md
```

### 4.3 正規表現パターン

#### import_tasks / include_tasks 検出

```
/^[ \t]*-?[ \t]*(import_tasks|include_tasks):[ \t]*['"]?([^'"{\s][^\s'"]*\.ya?ml)['"]?[ \t]*$/gm
```

- グループ1: ディレクティブ名 (`import_tasks` or `include_tasks`)
- グループ2: ファイルパス (`.yml` or `.yaml` で終わる文字列、クォートを除く)
- コメント行（`#` で始まる行）は `^[ \t]*-?` のパターンにより自然に除外される
- Jinja2変数 (`{{`) を含む値は `[^'"{\s]` により先頭 `{` でマッチしないため除外される

#### import_role / include_role 検出

```
/(import_role|include_role):[ \t]*\n(?:[ \t]+(?!name:[ \t])\S[^\n]*\n)*[ \t]+name:[ \t]*['"]?(\S+?)['"]?[ \t]*$/gm
```

- グループ1: ディレクティブ名 (`import_role` or `include_role`)
- グループ2: Role名（クォートを除く）
- **重要**: `[\s\S]*?` による貪欲マッチを避け、インデントブロック内の `name:` のみを対象とする
- ブロックの `name:` とプレイタスクレベルの `name:` を混同しない

### 4.4 パス解決ロジック

#### import_tasks / include_tasks
```
解決パス = path.resolve(現在のファイルのディレクトリ, 記述されたファイルパス)
```

#### import_role / include_role
```
解決パス = path.join(workspaceRoot, 'roles', roleName, 'tasks', 'main.yml')
           ↓ 存在しない場合
           path.join(workspaceRoot, 'roles', roleName, 'tasks', 'main.yaml')
```

#### ファイル存在確認（非同期）
```typescript
async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}
```

### 4.5 2フェーズパターン（provideDocumentLinks / resolveDocumentLink）

```typescript
class AnsibleLinkProvider implements vscode.DocumentLinkProvider {
    // フェーズ1: rangeのみ返す（高速）
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        // 正規表現でrangeを検出し、targetなしのDocumentLinkを返す
        // ファイルシステムへのアクセスは行わない
    }

    // フェーズ2: ホバー時にtargetを解決（遅延実行）
    async resolveDocumentLink(link: vscode.DocumentLink): Promise<vscode.DocumentLink> {
        // vscode.workspace.fs.stat() でファイル存在確認
        // 存在する場合のみ link.target と link.tooltip を設定して返す
        // 存在しない場合は target を設定せず返す（リンク無効化）
    }
}
```

---

## 5. package.json 定義

```json
{
  "name": "ansible-task-linker",
  "displayName": "Ansible Task Linker",
  "description": "Navigate import_tasks, include_tasks, import_role links in Ansible Playbooks",
  "version": "0.1.0",
  "publisher": "your-publisher-id",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-name/ansible-task-linker"
  },
  "keywords": ["ansible", "yaml", "playbook", "tasks", "navigation"],
  "engines": {
    "vscode": "^1.80.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onLanguage:yaml"
  ],
  "main": "./out/extension.js",
  "contributes": {},
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "test": "node ./out/test/runTests.js"
  },
  "devDependencies": {
    "@types/vscode": "^1.80.0",
    "@types/node": "18.x",
    "@types/mocha": "^10.0.0",
    "@vscode/test-electron": "^2.3.0",
    "mocha": "^10.0.0",
    "typescript": "^5.0.0"
  }
}
```

> **注意**: `contributes.languages` で `yaml` を再登録しないこと。`yaml` はVSCode組み込み言語であり、再定義すると他のYAML拡張機能（RedHat YAML等）と競合する恐れがある。DocumentLinkProviderの登録は `{ language: 'yaml' }` セレクターのみで十分。

---

## 6. 設定ファイル

### 6.1 tsconfig.json

```json
{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2020",
    "outDir": "out",
    "rootDir": "src",
    "lib": ["ES2020"],
    "sourceMap": true,
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "test"],
  "exclude": ["node_modules", ".vscode-test"]
}
```

### 6.2 .vscodeignore

```
.vscode/**
.vscode-test/**
src/**
test/**
out/test/**
node_modules/**
.gitignore
tsconfig.json
**/*.map
**/*.ts
```

### 6.3 .gitignore

```
node_modules/
out/
*.vsix
.vscode-test/
```

### 6.4 .vscode/launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    },
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
      ],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

### 6.5 extension.ts の構造

```typescript
import * as vscode from 'vscode';
import { AnsibleLinkProvider } from './providers/ansibleLinkProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new AnsibleLinkProvider();
    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider(
            { language: 'yaml' },
            provider
        )
    );
}

export function deactivate() {}
```

> **注意**: `context.subscriptions.push()` を使うことで、Extension無効化時に自動でProviderが解放される。

---

## 7. 実装上の注意事項

### 7.1 正規表現のマッチング精度
- Ansibleのインデントは2スペースが一般的だが、任意のインデントに対応すること
- ディレクティブ前の `-`（リストマーカー）は省略可能なケースも考慮する
- コメント行（`#` で始まる行）は正規表現の構造上自然に除外される
- クォート（シングル・ダブル）はキャプチャグループに含めず、除去した値を使用する

### 7.2 Role名の検出精度
- `import_role:` と `name:` の間に別のパラメータ（`vars:`, `tasks_from:` 等）が入るケースを考慮する
- `[\s\S]*?` による複数行ワイルドカードは**使用しない**（後続タスクの `name:` キーへの誤マッチが発生する）
- インデントブロック内のみをスキャンする正規表現（セクション4.3参照）を使用すること

### 7.3 パスのクォート処理
- YAML値がシングルクォートまたはダブルクォートで囲まれている場合、クォートを除去した値でパスを解決する
- Role名がクォートされている場合も同様に除去すること（クォートがパスに混入すると無効なパスになる）

### 7.4 Jinja2テンプレート変数のスキップ
- `{{` を含むパスは静的に解決不可能なため、リンク対象から除外する
- 正規表現の `[^'"{\s]` により先頭 `{` でマッチしないため自然に除外される

### 7.5 ワークスペース構成への対応
- Roleの検索は `workspaceRoot/roles/` 配下のみを対象とする（初期実装）
- Ansible Collection形式（`namespace.collection.role_name`）のRole名は解決不可。リンクなしとして扱う
- Ansible の `roles_path` 設定への対応は将来の拡張機能として保留

---

## 8. テスト

### 8.1 テストフレームワーク
- `@vscode/test-electron` + Mocha を使用
- テストは `test/suite/` 配下に配置し、`npm test` で実行可能とする

### 8.2 import_tasks / include_tasks テストケース

| ケース | 入力 | 期待結果 |
|--------|------|----------|
| 基本ケース | `- import_tasks: tasks/setup.yml` | `tasks/setup.yml` にリンク |
| include_tasks | `- include_tasks: handlers/main.yml` | `handlers/main.yml` にリンク |
| .yaml拡張子 | `- import_tasks: tasks/setup.yaml` | `tasks/setup.yaml` にリンク |
| インデントあり | `  - import_tasks: tasks/setup.yml` | `tasks/setup.yml` にリンク |
| ダブルクォート | `- import_tasks: "tasks/setup.yml"` | `tasks/setup.yml` にリンク |
| シングルクォート | `- import_tasks: 'tasks/setup.yml'` | `tasks/setup.yml` にリンク |
| ファイル不存在 | `- import_tasks: tasks/missing.yml` | リンクなし |
| コメント行 | `# - import_tasks: tasks/setup.yml` | リンクなし |
| Jinja2変数 | `- include_tasks: "{{ role_path }}/tasks/main.yml"` | リンクなし |

### 8.3 import_role / include_role テストケース

| ケース | 入力 | 期待結果 |
|--------|------|----------|
| 基本ケース | `- import_role:\n    name: common` | `roles/common/tasks/main.yml` にリンク |
| include_role | `- include_role:\n    name: webserver` | `roles/webserver/tasks/main.yml` にリンク |
| .yaml拡張子フォールバック | main.ymlが不存在、main.yamlが存在 | `roles/xxx/tasks/main.yaml` にリンク |
| Role不存在 | `- import_role:\n    name: missing` | リンクなし |
| クォートあり | `- import_role:\n    name: "my-role"` | `roles/my-role/tasks/main.yml` にリンク |
| 後続タスクの name | `- import_role:\n    tasks_from: pre\n- name: Run` | `Run` をRole名と誤認識しない |
| Collection形式 | `- import_role:\n    name: ns.col.role` | リンクなし |

---

## 9. 将来の拡張候補

| 機能 | 概要 |
|------|------|
| DefinitionProvider | Ctrl+クリック（Go to Definition）への対応 |
| HoverProvider | ホバー時に参照先ファイルのプレビュー表示 |
| roles_path対応 | `ansible.cfg` の `roles_path` を読み込み、複数Roleディレクトリに対応 |
| vars_files対応 | `vars_files:` ディレクティブへのリンク |
| インラインRole記法対応 | `import_role: { name: common }` 形式のサポート |
| モジュールスタイルのtasks対応 | `import_tasks:\n  file: tasks/setup.yml` 形式のサポート |
| tasks_from対応 | `include_role` の `tasks_from:` パラメータに対応したリンク解決 |
| Ansible Collection対応 | `namespace.collection.role_name` 形式のRole名解決 |

---

## 10. 開発・リリース手順

```bash
# 1. スキャフォールド生成
npm install -g yo generator-code
yo code

# 2. 依存関係インストール
npm install

# 3. ビルド
npm run compile

# 4. デバッグ実行（VSCode上でF5）
# Extension Development Host が起動する（.vscode/launch.json の "Run Extension" 設定を使用）

# 5. テスト実行
npm test

# 6. パッケージング（publisher フィールドが必須）
npm install -g @vscode/vsce
vsce package

# 7. ローカルインストール
code --install-extension ansible-task-linker-0.1.0.vsix
```
