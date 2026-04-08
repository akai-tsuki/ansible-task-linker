# VSCode拡張機能 仕様書
# Ansible Task Linker

## 1. 概要

### 1.1 プロジェクト名
`ansible-task-linker`

### 1.2 目的
Ansible Playbookの開発効率を向上させるため、YAMLファイル内の各種ディレクティブに対して、参照先ファイルへのナビゲーション機能を提供するVSCode拡張機能を開発する。

主な機能:
- `import_tasks` / `include_tasks` / `import_role` / `include_role` / `import_playbook` に対するクリック遷移（DocumentLink）
- 上記ディレクティブに対する `Go to Definition`（F12 / DefinitionProvider）
- `tasks_from` パラメータを考慮した role タスクファイルへの遷移

解析方式には YAML パーサ（`yaml` パッケージ）による AST ベースのアプローチを採用し、引用符・map 形式・複数行構造などの構文揺れに対して堅牢に動作する。

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
```

**非対応（スキップするケース）:**

```yaml
# Jinja2テンプレート変数を含むパスは静的解決不可のためスキップ
- include_tasks: "{{ role_path }}/tasks/setup.yml"
- include_tasks: "tasks/{{ environment }}.yml"
```

#### 2.1.2 import_playbook

| 項目 | 内容 |
|------|------|
| 対象ディレクティブ | `import_playbook` |
| リンク対象 | ディレクティブの値に記述されたファイルパス |
| パス解決方法 | 現在開いているYAMLファイルからの**相対パス**で解決 |
| リンク表示範囲 | ファイルパス文字列の部分のみ（クォートは除く） |
| ファイルが存在しない場合 | リンクを表示しない |

**対応するYAML記法:**

```yaml
- import_playbook: site.yml
- import_playbook: "../other/deploy.yml"
- import_playbook: "sub/playbook.yml"
```

#### 2.1.3 import_role / include_role

| 項目 | 内容 |
|------|------|
| 対象ディレクティブ | `import_role`, `include_role` |
| リンク対象 | `name:` パラメータに記述されたRole名 |
| 解決先ファイル | `{workspaceRoot}/roles/{role_name}/tasks/main.yml` |
| 拡張子フォールバック | `.yml` が存在しない場合 `.yaml` を試みる |
| `tasks_from` 対応 | 指定時は `main.yml` の代わりに `tasks/{tasks_from}.yml` を解決先とする |
| リンク表示範囲 | Role名文字列の部分のみ（クォートは除く） |
| ファイルが存在しない場合 | リンクを表示しない |
| ワークスペース未設定の場合 | リンク解決をスキップする |

**対応するYAML記法:**

```yaml
# ブロックスタイル
- import_role:
    name: common

- include_role:
    name: webserver

# tasks_from 指定
- include_role:
    name: common
    tasks_from: install

# name と他パラメータが混在するケース
- import_role:
    vars:
      key: value
    name: common

# インラインmap形式
- import_role: { name: common }
```

**制限事項:**

```yaml
# Ansible Collection形式のRole名は解決不可（roles/ 配下に存在しないため）
- import_role:
    name: namespace.collection.role_name  # リンクなし
```

---

### 2.2 Go to Definition 機能（F12）

対象ディレクティブの参照値の上でカーソルを置いた状態で `F12` または `Go to Definition` を実行すると、解決先ファイルの先頭へ移動する。

| 項目 | 内容 |
|------|------|
| 対象ディレクティブ | DocumentLink と同一（2.1.1 〜 2.1.3 参照） |
| 移動先 | 解決されたファイルの先頭（行0, 列0） |
| 解決できない場合 | 何も返さない（エラーなし） |

---

### 2.3 対象ファイル

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
- ワークスペースが未設定の場合は `import_role` / `include_role` のリンク解決をスキップする（`import_tasks` / `include_tasks` / `import_playbook` はスキップしない）
- YAML の構文エラーを含むドキュメントは安全にスキップし、拡張機能を異常終了させない
- Jinja2 式（`{{ }}` / `{% %}`）を含む値は例外を投げず安全に無視する

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
| `vscode.languages.registerDefinitionProvider` | DefinitionProviderの登録 |
| `vscode.DocumentLinkProvider` | リンクプロバイダーのインターフェース |
| `vscode.DefinitionProvider` | 定義ジャンププロバイダーのインターフェース |
| `vscode.DocumentLink` | リンクオブジェクトの生成 |
| `vscode.DocumentLink.tooltip` | ホバー時に解決済み絶対パスを表示 |
| `vscode.Location` | 定義ジャンプ先の位置 |
| `vscode.Range` | リンク表示範囲の指定 |
| `vscode.Uri.file()` | ファイルURIの生成 |
| `vscode.workspace.getWorkspaceFolder()` | ワークスペースルートの取得 |
| `vscode.workspace.fs.stat()` | ファイル存在確認（仮想FSに対応、非同期） |
| `document.getText()` | ドキュメント全体テキストの取得 |
| `document.positionAt(offset)` | 文字オフセットを `vscode.Position` に変換（Range生成に必要） |

### 4.2 ファイル構成

```
ansible-task-linker/
├── src/
│   ├── extension.ts                            # エントリーポイント（activate/deactivate）
│   ├── model/
│   │   └── ansibleReference.ts                 # 参照情報の型定義
│   ├── parser/
│   │   ├── astUtils.ts                         # YAML ASTユーティリティ
│   │   └── parseAnsibleReferences.ts           # YAMLドキュメントから参照情報を抽出
│   ├── resolver/
│   │   └── resolveAnsibleReference.ts          # 参照情報から実ファイルURIを解決
│   ├── providers/
│   │   ├── ansibleDocumentLinkProvider.ts      # DocumentLinkProvider実装
│   │   └── ansibleDefinitionProvider.ts        # DefinitionProvider実装
│   └── utils/
│       ├── pathUtils.ts                        # パス解決ユーティリティ
│       └── workspaceUtils.ts                   # ワークスペースユーティリティ
├── test/
│   ├── suite/
│   │   ├── index.ts                            # Mochaテストランナー設定
│   │   ├── importTasks.test.ts                 # import_tasks / include_tasks テスト
│   │   ├── importRole.test.ts                  # import_role / include_role テスト
│   │   ├── importPlaybook.test.ts              # import_playbook テスト
│   │   └── tasksFrom.test.ts                   # tasks_from テスト
│   └── runTests.ts                             # @vscode/test-electron エントリーポイント
├── .vscode/
│   ├── launch.json                             # F5デバッグ設定
│   └── tasks.json                              # ビルドタスク設定
├── package.json                                # 拡張機能マニフェスト
├── tsconfig.json
├── .vscodeignore
├── .gitignore
├── CHANGELOG.md
└── README.md
```

### 4.3 参照モデル

```typescript
type AnsibleReferenceKind =
    | 'include_tasks'
    | 'import_tasks'
    | 'import_playbook'
    | 'include_role'
    | 'import_role';

interface AnsibleReference {
    kind: AnsibleReferenceKind;
    sourceUri: vscode.Uri;
    /** クリック可能な値テキストの範囲（クォート除く） */
    sourceRange: vscode.Range;
    /** YAMLスカラーから抽出した生の文字列値 */
    rawValue: string;
    roleName?: string;   // role系ディレクティブのみ
    tasksFrom?: string;  // tasks_from 指定時のみ
}
```

### 4.4 YAML AST ベースの解析

テキストの正規表現走査ではなく、`yaml` パッケージの AST を使ってディレクティブを抽出する。

**基本方針:**

- `yaml.parseAllDocuments(text)` で複数ドキュメント YAML に対応
- `doc.errors.length > 0` のドキュメントはスキップ
- `YAMLSeq` / `YAMLMap` を再帰的に走査し、対象キーを持つ `Pair` を検出
- `Scalar.range` と `Scalar.type` を使ってクォートを除いたコンテンツ範囲を算出

**スカラー範囲の計算:**

`yaml` パッケージの `Scalar.range` は `[start, end, nodeEnd]` のオフセット配列。クォート付きスカラーでは `start` が開きクォート位置を指す。

```typescript
const isQuoted = scalar.type === 'QUOTE_SINGLE' || scalar.type === 'QUOTE_DOUBLE';
const contentStart = isQuoted ? start + 1 : start;
const contentEnd   = isQuoted ? end   - 1 : end;
const range = new vscode.Range(
    document.positionAt(contentStart),
    document.positionAt(contentEnd)
);
```

### 4.5 パス解決ロジック

#### import_tasks / include_tasks
```
1. path.resolve(現在のファイルのディレクトリ, 記述されたパス)
2. パスにディレクトリ成分がない場合は tasks/<file> も試す
```

#### import_playbook
```
path.resolve(現在のファイルのディレクトリ, 記述されたパス)
```

#### import_role / include_role（tasks_from なし）
```
roles/<roleName>/tasks/main.yml
↓ 存在しない場合
roles/<roleName>/tasks/main.yaml
```

#### import_role / include_role（tasks_from あり）
```
roles/<roleName>/tasks/<tasksFrom>.yml
↓ 存在しない場合
roles/<roleName>/tasks/<tasksFrom>.yaml
```

※ role の解決は対象ドキュメントが属する workspace folder を基準とする。

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

### 4.6 2フェーズパターン（DocumentLinkProvider）

```typescript
class AnsibleDocumentLinkProvider implements vscode.DocumentLinkProvider {
    // フェーズ1: YAML AST解析でrangeのみ返す（高速・FS非アクセス）
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        const references = parseAnsibleReferences(document);
        return references.map(ref => new vscode.DocumentLink(ref.sourceRange));
    }

    // フェーズ2: ホバー時にtargetを解決（遅延実行）
    async resolveDocumentLink(link: vscode.DocumentLink): Promise<vscode.DocumentLink> {
        // resolveAnsibleReference() でファイル存在確認
        // 存在する場合のみ link.target と link.tooltip を設定して返す
    }
}
```

```typescript
class AnsibleDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Definition | undefined> {
        const references = parseAnsibleReferences(document);
        const ref = references.find(r => r.sourceRange.contains(position));
        if (!ref) return undefined;
        const uri = await resolveAnsibleReference(ref);
        return uri ? new vscode.Location(uri, new vscode.Position(0, 0)) : undefined;
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
  "version": "0.1.1",
  "publisher": "akai-tsuki",
  "license": "MIT",
  "engines": { "vscode": "^1.80.0" },
  "activationEvents": ["onLanguage:yaml"],
  "main": "./out/src/extension.js",
  "dependencies": {
    "yaml": "^2.0.0"
  },
  "devDependencies": {
    "@types/glob": "^8.1.0",
    "@types/mocha": "^10.0.0",
    "@types/node": "18.x",
    "@types/vscode": "^1.80.0",
    "@vscode/test-electron": "^2.3.0",
    "mocha": "^10.0.0",
    "typescript": "^5.0.0"
  }
}
```

> **注意**: `contributes.languages` で `yaml` を再登録しないこと。`yaml` はVSCode組み込み言語であり、再定義すると他のYAML拡張機能（RedHat YAML等）と競合する恐れがある。

---

## 6. 設定ファイル

### 6.1 tsconfig.json

```json
{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2020",
    "outDir": "out",
    "rootDir": ".",
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
import { AnsibleDocumentLinkProvider } from './providers/ansibleDocumentLinkProvider';
import { AnsibleDefinitionProvider } from './providers/ansibleDefinitionProvider';

export function activate(context: vscode.ExtensionContext) {
    const yamlSelector = { language: 'yaml' };
    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider(
            yamlSelector,
            new AnsibleDocumentLinkProvider()
        ),
        vscode.languages.registerDefinitionProvider(
            yamlSelector,
            new AnsibleDefinitionProvider()
        )
    );
}

export function deactivate() {}
```

> **注意**: `context.subscriptions.push()` を使うことで、Extension無効化時に自動でProviderが解放される。

---

## 7. 実装上の注意事項

### 7.1 YAML AST 解析の方針
- `yaml.parseAllDocuments(text)` で複数ドキュメントに対応する
- `doc.errors.length > 0` のドキュメントは解析をスキップし、拡張機能を安全に保つ
- トラバーサル全体を `try-catch` で囲み、予期しないノード構造でも例外を出さない

### 7.2 動的値のスキップ
- `{{ ... }}` または `{% ... %}` を含む値は Jinja2 式とみなし、リンク化も Definition 返却もしない
- `isDynamic(value: string): boolean` ヘルパーで一元的に検出する

### 7.3 クォート処理
- YAML値がシングルクォートまたはダブルクォートで囲まれている場合、`Scalar.type` で判別してクォートを除いた範囲を `sourceRange` とする
- クォート文字そのものはリンク範囲に含めない（4.4節参照）

### 7.4 Role名の Collection 形式除外
- `roleName.includes('.')` で Ansible Collection 形式（`namespace.collection.role`）を検出し、リンク対象から除外する

### 7.5 tasks_from の動的値
- `tasks_from` の値に Jinja2 式が含まれる場合は `tasks_from` を無視し、`main.yml` / `main.yaml` へのフォールバック解決を維持する

### 7.6 ワークスペース構成への対応
- Roleの検索は `workspaceRoot/roles/` 配下のみを対象とする（初期実装）
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
| include_tasks | `- include_tasks: tasks/setup.yml` | リンクあり |
| ダブルクォート | `- import_tasks: "tasks/setup.yml"` | リンクあり |
| シングルクォート | `- import_tasks: 'tasks/setup.yml'` | リンクあり |
| インデントあり | `  - import_tasks: tasks/setup.yml` | リンクあり |
| ディレクトリなし指定 | `- include_tasks: check.yml` | `tasks/check.yml` にリンク |
| ファイル不存在 | `- import_tasks: tasks/missing.yml` | リンクなし |
| コメント行 | `# - import_tasks: tasks/setup.yml` | リンクなし |
| Jinja2変数 | `- include_tasks: "{{ role_path }}/tasks/main.yml"` | リンクなし |

### 8.3 import_role / include_role テストケース

| ケース | 入力 | 期待結果 |
|--------|------|----------|
| 基本ケース | `- import_role:\n    name: common` | `roles/common/tasks/main.yml` にリンク |
| include_role | `- include_role:\n    name: common` | リンクあり |
| .yaml拡張子フォールバック | main.ymlが不存在、main.yamlが存在 | `roles/xxx/tasks/main.yaml` にリンク |
| Role不存在 | `- import_role:\n    name: missing` | リンクなし |
| クォートあり | `- import_role:\n    name: "my-role"` | `roles/my-role/tasks/main.yml` にリンク |
| 後続タスクの name | `- import_role:\n    tasks_from: pre\n- name: Run` | `Run` をRole名と誤認識しない |
| Collection形式 | `- import_role:\n    name: ns.col.role` | リンクなし |

### 8.4 import_playbook テストケース

| ケース | 入力 | 期待結果 |
|--------|------|----------|
| 基本ケース | `- import_playbook: site.yml` | `site.yml` にリンク |
| 相対パス | `- import_playbook: sub/deploy.yml` | `sub/deploy.yml` にリンク |
| ダブルクォート | `- import_playbook: "site.yml"` | リンクあり |
| ファイル不存在 | `- import_playbook: missing.yml` | リンクなし |
| Jinja2変数 | `- import_playbook: "{{ env }}/site.yml"` | リンクなし |

### 8.5 tasks_from テストケース

| ケース | 入力 | 期待結果 |
|--------|------|----------|
| tasks_from なし | `- include_role:\n    name: myrole` | `roles/myrole/tasks/main.yml` にリンク |
| tasks_from (.yml) | `- include_role:\n    name: myrole\n    tasks_from: install` | `roles/myrole/tasks/install.yml` にリンク |
| tasks_from (.yaml) | `- include_role:\n    name: myrole\n    tasks_from: config` | `roles/myrole/tasks/config.yaml` にリンク |
| import_role + tasks_from | `- import_role:\n    name: myrole\n    tasks_from: install` | `roles/myrole/tasks/install.yml` にリンク |
| tasks_from 不存在 | `- include_role:\n    name: myrole\n    tasks_from: missing` | リンクなし |
| tasks_from Jinja2 | `- include_role:\n    name: myrole\n    tasks_from: "{{ var }}"` | `main.yml` にリンク（フォールバック） |

---

## 9. 非対応範囲

初期実装では以下は対象外とする。

| 項目 | 概要 |
|------|------|
| Jinja2評価 | `{{ }}` を評価して実パスを求めること |
| Ansible Collection役解決 | `namespace.collection.role` 形式の Role 名解決 |
| Ansible全探索仕様の再現 | `roles_path` 等の設定を読み込む完全なロール探索 |
| 追加ディレクティブ | `include_vars` 等、今回対象外のディレクティブ |
| ワークスペース外リソース | ワークスペース外ファイルの探索 |
| import_tasks のmap形式 | `import_tasks:\n  file: tasks/setup.yml` 形式 |

---

## 10. 将来の拡張候補

| 機能 | 概要 |
|------|------|
| HoverProvider | ホバー時に参照先ファイルのプレビュー表示 |
| roles_path対応 | `ansible.cfg` の `roles_path` を読み込み、複数Roleディレクトリに対応 |
| vars_files対応 | `vars_files:` ディレクティブへのリンク |
| import_tasks map形式 | `import_tasks:\n  file: tasks/setup.yml` 形式のサポート |
| Ansible Collection対応 | `namespace.collection.role_name` 形式のRole名解決 |
| ワークスペース横断探索 | 複数ワークスペースフォルダをまたいだロール探索 |

---

## 11. 開発・リリース手順

```bash
# 1. 依存関係インストール
npm install

# 2. ビルド
npm run compile

# 3. デバッグ実行（VSCode上でF5）
# Extension Development Host が起動する（.vscode/launch.json の "Run Extension" 設定を使用）

# 4. テスト実行
npm test

# 5. パッケージング（publisher フィールドが必須）
npm install -g @vscode/vsce
vsce package

# 6. ローカルインストール
code --install-extension ansible-task-linker-0.1.1.vsix
```
