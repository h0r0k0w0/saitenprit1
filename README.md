# saitenprit1

複数のLLMに同一プロンプトを送り、メンタライジング採点のJSONを比較するための
シンプルなNext.jsアプリです。Vercelにそのままデプロイできます。

## 使い方

```bash
npm install
npm run dev
```

### 環境変数

各プロバイダーのAPIキーを設定してください。

```
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
```

## エンドポイント

`POST /api/evaluate`

```json
{
  "model": "gpt-5.2-2025-12-11",
  "provider": "openai",
  "scenario": "...",
  "response": "...",
  "promptTemplate": "...",
  "temperature": 0.2,
  "maxTokens": 1200
}
```
