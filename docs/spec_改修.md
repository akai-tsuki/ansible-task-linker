# ansible-task-linker 改修仕様

## 目的

`ansible-task-linker` を、Ansible Playbook 内の参照解決に対してより堅牢で拡張しやすい VS Code 拡張へ改修する。

主な狙いは以下の通り。

- 正規表現ベースの解析を YAML AST ベースへ置き換え、構文揺れへの耐性を上げる
- 既存のクリック遷移に加えて Go to Definition を提供する
- `import_playbook` と `tasks_from` をサポートし、実用上の対応範囲を広げる
- 既存の実用的な解決ルール (`tasks/` フォールバック、`main.yaml` 対応) は維持する

## 背景

現行の `ansible-task-linker` は `DocumentLinkProvider` を使って以下をサポートしている。

- `import_tasks`
- `include_tasks`
- `import_role`
- `include_role`

現行実装は正規表現ベースであり、シンプルで軽量だが、以下の課題がある。

- YAML のネスト構造や複数表現に弱い
- 引用符や map 形式などの記述揺れに対して保守が難しい
- `Go to Definition` に未対応
- `import_playbook` に未対応
- `tasks_from` に未対応

一方で、現行実装には以下の有用な挙動があるため、改修後も維持する。

- `include_tasks: check.yml` のようなファイル名のみ指定時に `tasks/check.yml` を探す
- role の既定タスクとして `main.yml` に加えて `main.yaml` も探す

## 改修方針

### 1. 解析方式を YAML AST ベースへ変更する

テキストに対する正規表現走査ではなく、YAML パーサを使って AST を構築し、ノードを走査して Ansible の参照を抽出する。

期待効果:

- 引用符付き scalar を安定して扱える
- map 形式や複数行構造を安全に扱える
- 参照値の範囲を正確に取得できる
- `DocumentLinkProvider` と `DefinitionProvider` で共通利用できる

推奨事項:

- `yaml` パッケージを利用する
- `parseAllDocuments` 相当で複数ドキュメント YAML に対応する
- 構文エラーを含むドキュメントは安全にスキップする

### 2. リンク抽出とパス解決を分離する

将来の機能追加とテスト容易性のため、以下の責務に分割する。

- parser: YAML AST から参照情報を抽出する
- model: 参照情報の型を持つ
- resolver: 参照情報から実ファイルの URI を解決する
- provider: VS Code API に接続する

期待効果:

- `DocumentLinkProvider` と `DefinitionProvider` の実装重複を避けられる
- パーサとパス解決を個別にテストできる
- 今後の対応ディレクティブ追加が容易になる

## 機能要件

### 1. 対応ディレクティブ

改修後は以下をサポートする。

- `include_tasks`
- `import_tasks`
- `include_role`
- `import_role`
- `import_playbook`

### 2. Document Link

対象ディレクティブの参照値部分をクリック可能にする。

要件:

- 値そのものの範囲のみをリンク化する
- 引用符で囲まれている場合、引用符そのものはリンク範囲に含めない
- 解決できた場合のみリンクを有効化する

### 3. Go to Definition

対象ディレクティブの参照位置で `F12` または `Go to Definition` を実行すると、解決先ファイルの先頭へ移動できること。

要件:

- `DocumentLinkProvider` と同じ参照抽出・解決ロジックを使う
- 解決できない場合は何も返さない

### 4. `include_tasks` / `import_tasks` の解決ルール

以下の順で解決を試みる。

1. 記述されたパスを、現在の YAML ファイルのディレクトリ基準で相対解決する
2. パスにディレクトリ成分がない場合、`tasks/<file>` も試す

補足:

- `.yml` / `.yaml` のどちらもそのまま扱う
- パス区切りは OS に応じて正規化する

### 5. `import_playbook` の解決ルール

以下のルールで解決する。

- 現在の YAML ファイルのディレクトリ基準で相対解決する

初期版では以下は対象外とする。

- Ansible 独自の複雑な探索ルールの完全再現

### 6. `include_role` / `import_role` の解決ルール

role 名から以下を解決する。

- 基本: `roles/<roleName>/tasks/main.yml`
- `main.yml` がなければ `roles/<roleName>/tasks/main.yaml`

さらに `tasks_from` が指定されている場合は以下を優先する。

- `roles/<roleName>/tasks/<tasks_from>.yml`
- 上記がなければ `roles/<roleName>/tasks/<tasks_from>.yaml`

補足:

- workspace が開かれていることを前提とする
- role 解決は、対象ドキュメントが属する workspace folder を基準とする

### 7. 動的値の扱い

以下のような動的値は解決対象外とする。

- `{{ ... }}`
- `{% ... %}`

要件:

- リンク化しない
- Definition も返さない
- 例外を投げず安全にスキップする

## 非機能要件

### 1. 互換性

- 既存の `import_tasks` / `include_tasks` / `import_role` / `include_role` の基本挙動は維持する
- 既存利用者にとって明確な退行を生まないこと

### 2. 保守性

- provider 内に解決ロジックを閉じ込めない
- 型定義を明示し、参照情報を構造化する
- テストしやすい責務分離にする

### 3. 性能

- 通常の playbook サイズで VS Code 操作に体感遅延を出さないこと
- 解決不能な参照や YAML エラーで例外的に重くならないこと

## 非対応範囲

初期改修では以下は対象外とする。

- Jinja2 を評価して実パスを求めること
- Ansible Collection 形式の role 名解決 (`namespace.collection.role`)
- Ansible 全探索仕様の完全再現
- `include_vars` など今回対象外の別ディレクティブ対応
- ワークスペース外リソース探索

## 実装イメージ

推奨ディレクトリ構成例:

- `src/extension.ts`
- `src/model/ansibleReference.ts`
- `src/parser/parseAnsibleReferences.ts`
- `src/parser/astUtils.ts`
- `src/resolver/resolveAnsibleReference.ts`
- `src/providers/ansibleDocumentLinkProvider.ts`
- `src/providers/ansibleDefinitionProvider.ts`
- `src/utils/pathUtils.ts`
- `src/utils/workspaceUtils.ts`

参照モデル例:

- `kind`
- `sourceUri`
- `sourceRange`
- `rawValue`
- `roleName`
- `tasksFrom`

## 受け入れ条件

以下を満たしたら完了とする。

1. `include_tasks` / `import_tasks` のリンク遷移が従来どおり動作する
2. ディレクトリなし指定時の `tasks/` フォールバックが維持される
3. `include_role` / `import_role` で `main.yml` と `main.yaml` の両方を解決できる
4. `tasks_from` 指定時に対象タスクファイルへ遷移できる
5. `import_playbook` で対象 playbook へ遷移できる
6. `F12` / `Go to Definition` が対象参照で動作する
7. `{{ ... }}` や `{% ... %}` を含む動的値は安全に無視される
8. YAML の構文エラーがあっても拡張が異常終了しない

## テスト観点

最低限、以下のケースを確認する。

- `include_tasks: tasks/setup.yml`
- `include_tasks: "tasks/setup.yml"`
- `include_tasks: check.yml` から `tasks/check.yml` へ解決
- `import_tasks: tasks/deploy.yaml`
- `import_playbook: ../site.yml`
- `include_role: { name: common }`
- `include_role` の map 形式で `tasks_from: install`
- `import_role` の複数行形式
- `{{ var }}` を含むパスのスキップ
- 不正 YAML を含むファイルでの安全動作

## 将来拡張

今回の改修後、必要に応じて以下を検討できる状態にする。

- Ansible Collection role 解決
- 追加ディレクティブ対応
- hover で解決先表示
- workspace 横断探索
