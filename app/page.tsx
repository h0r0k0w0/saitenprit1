"use client";

import { useMemo, useState } from "react";

const DEFAULT_TEMPLATE = `あなたは「短文シナリオに対する自由記述回答」から、他者メンタライジングを2軸で採点する評価者です。\nこの評価は、与えられた【SCENARIO】【RESPONSE】のみを根拠に行います。\n\n\n【質(Q)】=シナリオ根拠に基づく心的状態理解のまとまり\n【探索(E)】=シナリオ外も含む仮説生成の多様性（ただし不確実性を保つ）\n以下のルールと採点基準に厳密に従い、JSONのみを返してください。\n\n# 入力\n【SCENARIO】\n<<<ここにシナリオ>>>\n\n【RESPONSE】\n<<<ここに自由記述回答>>>\n\n# 共通ルール（必須）\n1) シナリオにない事実の“断定”は禁止。ただし探索(E)では、仮説としての追加推測は許可（不確実性マーカー必須）。\n2) 一般論との比較（「普通なら〜だが」等）は加点対象（QでもEでも可）。ただしシナリオ要素と結びつけること。\n3) 不確実性は「〜かも」「可能性」「確率」「6:4」「70%」等でも同等に評価。\n4) 性格ラベルより心的状態（感情・信念・欲求・葛藤）を優先して評価。\n5) 出力はJSONのみ。要約・助言は禁止。\n\n# シナリオ外推測の扱い（モデル割れ防止の追加ルール）\n- R_PRIV：職業/立場（店員–客、上司–部下、先輩–後輩など）に由来する距離感・プライバシー境界の推測は、\n  「仮説」として書かれていれば加点可。断定はR1。\n- R_POLITE：礼儀的・短い応答（例：ありがとうございます）は、表面/内面（D）や複合感情（H）の仮説として加点可。\n  「本心の感謝/不満の抑制」など最大2案の代替があればE1も加点。\n- R_TIME：「一度注意した」等は“過去に対応があった”ことは示すが、長期化・常習は断定不可。\n  長期化は仮説なら加点可、断定ならR1。\n- R_NUM：確率・割合表現はC（不確実性）で加点対象。ただし数値が根拠なく乱用されても、C以外（A/F等）は自動では上がらない。\n  数値乱用自体はRunawayにしない（内容で判断）。\n- R_MOTIVE：利害・悪意・操作（例：金のため、面倒だから、妬みで抑える等）は\n  「可能性の一つ」として短く提示し、代替案（善意/配慮など）も併記なら加点可。単一悪意仮説の強断定・長文化はR1/R2。\n\n# 1) 質(Q)スコア：項目（各0〜2点、最大18点）\nA 具体性：シナリオ要素（発言/行動/状況）に根拠づく\nB 心的状態：感情・意図・信念・欲求・葛藤が具体的\nC 不確実性：心の不可視性を適切に保留（%等も可）\nD 表面/内面：言動と内心のズレを扱う\nE 複数視点：登場人物間の視点差（A視点/B視点）を対比\nF 行動↔心理：心理→言動/言動→心理の因果リンク\nG 相互作用：片方の反応が相手/場に与える影響を具体化\nH 複合感情：混在/葛藤を扱う\nI 規範比較：一般的期待との比較を状況に即して説明\n\n# 2) 探索(E)スコア：項目（各0〜2点、最大10点）\nE1 代替仮説の多様性：\n  0=代替仮説がほぼ無い\n  1=少なくとも2案の可能性（または「状況Aなら…/状況Bなら…」等の分岐）がある\n  2=3案以上、または複数の分岐を体系的に提示（ただし断定しない）\nE2 関係性/力学の仮説：関係性・権力差・距離感などを仮説として提示（断定不可）\nE3 将来展開/対応の仮説：この後どうなる/どう声かけ等を仮説として提示（断定不可）\nE4 限界意識/自己修正：テキストだけでは不確実、追加情報が必要等のメタ認識（短く）\nE5 文脈拡張：組織/部活/家庭などの一般的文脈を“仮説として”接続（断定不可）\n\n# 3) 暴走ペナルティ（Runaway 0〜6点：総合で減点）\nR1 断定的作り込み（0-3）：\n  シナリオ外の事実を「普段から」「毎回」「強豪校で毎年賞」「4日しかない」等、断定して積み上げる\nR2 人格/病理診断（0-2）：\n  「パワハラ気質」「精神不安定」「ノンデリな性格」等の断定的ラベリング\nR3 説教/価値判断中心（0-1）\n\n# 合成点（必ず算出）\nQ_raw = A+B+C+D+E+F+G+H+I        # 0-18\nE_raw = E1+E2+E3+E4+E5            # 0-10\nRunaway = R1+R2+R3                # 0-6\n\nQ_100 = round((Q_raw/18)*100)\nE_100 = round((E_raw/10)*100)\n\nTotal_100 = round( 0.6*Q_100 + 0.4*E_100 - 10*Runaway )\nTotal_100 = max(min(Total_100,100),0)\n\n# 出力形式（JSONのみ）\n{\n  \"Q_scores_0_2\": {\n    \"A_specificity\": {\"score\":0,\"evidence\":[]},\n    \"B_mental_states\": {\"score\":0,\"evidence\":[]},\n    \"C_uncertainty\": {\"score\":0,\"evidence\":[]},\n    \"D_surface_inner\": {\"score\":0,\"evidence\":[]},\n    \"E_multiple_perspectives\": {\"score\":0,\"evidence\":[]},\n    \"F_behavior_psych_link\": {\"score\":0,\"evidence\":[]},\n    \"G_interaction\": {\"score\":0,\"evidence\":[]},\n    \"H_mixed_emotions\": {\"score\":0,\"evidence\":[]},\n    \"I_normative_comparison\": {\"score\":0,\"evidence\":[]}\n  },\n  \"E_scores_0_2\": {\n    \"E1_alternatives\": {\"score\":0,\"evidence\":[]},\n    \"E2_relationship_dynamics\": {\"score\":0,\"evidence\":[]},\n    \"E3_future_or_intervention\": {\"score\":0,\"evidence\":[]},\n    \"E4_limits_metacognition\": {\"score\":0,\"evidence\":[]},\n    \"E5_contextual_extension\": {\"score\":0,\"evidence\":[]}\n  },\n  \"runaway_penalties\": {\n    \"R1_overconfident_fabrication\": {\"score\":0,\"reason\":\"\"},\n    \"R2_trait_or_pathology_labeling\": {\"score\":0,\"reason\":\"\"},\n    \"R3_preaching\": {\"score\":0,\"reason\":\"\"}\n  },\n  \"Q_raw_0_18\": 0,\n  \"E_raw_0_10\": 0,\n  \"Runaway_0_6\": 0,\n  \"Q_0_100\": 0,\n  \"E_0_100\": 0,\n  \"Total_0_100\": 0,\n  \"one_sentence_rationale\": \"\"\n}\n\n\nevidenceは【RESPONSE】から最大3つ、各30字以内の原文フレーズ引用。`;

// モデルごとの設定はここで管理します。
// id: APIに渡すモデル名 / label: UI表示名 / provider: APIプロバイダー
const MODEL_OPTIONS = [
  {
    id: "gpt-5.2-2025-12-11",
    label: "GPT-5.2 (OpenAI)",
    provider: "openai"
  },
  {
    id: "claude-opus-4-5-20251101",
    label: "Claude Opus 4.5 (Anthropic)",
    provider: "anthropic"
  },
  {
    id: "gemini-3-pro-preview",
    label: "Gemini 3 Pro Preview (Google)",
    provider: "gemini"
  }
] as const;

const MAX_SEEDS = 10;

export default function Home() {
  const [modelId, setModelId] = useState<
    (typeof MODEL_OPTIONS)[number]["id"]
  >(MODEL_OPTIONS[0].id);
  const [scenario, setScenario] = useState("");
  const [response, setResponse] = useState("");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  // モデル共通の生成パラメータはここで初期値を設定できます。
  // 例: 温度(temperature)や最大トークン数(maxTokens)を変更したい場合は下を編集します。
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(1200);
  const [seedInput, setSeedInput] = useState("1,2,3,4,5,6,7,8,9,10");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedModel = useMemo(
    () => MODEL_OPTIONS.find((option) => option.id === modelId),
    [modelId]
  );

  const parseSeeds = (value: string) => {
    const seeds = value
      .split(/[\s,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry));
    return Array.from(new Set(seeds)).slice(0, MAX_SEEDS);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const seeds = parseSeeds(seedInput);
      if (seeds.length === 0) {
        throw new Error("seedを1つ以上入力してください。");
      }
      if (seeds.length > MAX_SEEDS) {
        throw new Error(`seedは最大${MAX_SEEDS}個までにしてください。`);
      }

      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          provider: selectedModel?.provider,
          scenario,
          response,
          promptTemplate: template,
          temperature,
          maxTokens,
          seeds
        })
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "評価に失敗しました。");
      }

      setOutput(JSON.stringify(payload, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "予期せぬエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div className="tag">Vercel-ready</div>
      <h1>メンタライジング採点コンソール</h1>
      <p>
        GPT-5.2 / Claude Opus 4.5 / Gemini 3 Pro Preview で同じ採点プロンプトを
        実行できる簡易UIです。APIキーは環境変数で設定し、モデルと生成パラメータを
        切り替えられます。
      </p>

      <section className="grid cols-2">
        <div className="card">
          <h2>入力</h2>
          <div className="grid">
            <div>
              <label htmlFor="model">モデル</label>
              <select
                id="model"
                value={modelId}
                onChange={(event) =>
                  setModelId(
                    event.target.value as (typeof MODEL_OPTIONS)[number]["id"]
                  )
                }
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>Provider: {selectedModel?.provider}</small>
            </div>

            <div className="grid cols-2">
              <div>
                <label htmlFor="temperature">Temperature</label>
                <input
                  id="temperature"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={temperature}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                />
              </div>
              <div>
                <label htmlFor="maxTokens">Max tokens</label>
                <input
                  id="maxTokens"
                  type="number"
                  min={200}
                  max={4000}
                  value={maxTokens}
                  onChange={(event) => setMaxTokens(Number(event.target.value))}
                />
              </div>
            </div>

            <div>
              <label htmlFor="seeds">seed (最大10個)</label>
              <textarea
                id="seeds"
                placeholder="例: 1,2,3,4,5,6,7,8,9,10"
                value={seedInput}
                onChange={(event) => setSeedInput(event.target.value)}
              />
              <small>
                カンマ/改行区切りで最大10個まで入力できます。重複は自動で除外されます。
              </small>
            </div>

            <div>
              <label htmlFor="scenario">SCENARIO</label>
              <textarea
                id="scenario"
                placeholder="シナリオを入力"
                value={scenario}
                onChange={(event) => setScenario(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="response">RESPONSE</label>
              <textarea
                id="response"
                placeholder="自由記述回答を入力"
                value={response}
                onChange={(event) => setResponse(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="template">プロンプトテンプレート</label>
              <textarea
                id="template"
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
              />
              <small>
                テンプレート内の「&lt;&lt;&lt;ここにシナリオ&gt;&gt;&gt;」「&lt;&lt;&lt;ここに自由記述回答&gt;&gt;&gt;」が自動で
                置換されます。
              </small>
            </div>
          </div>

          <button onClick={handleSubmit} disabled={loading}>
            {loading ? "評価中..." : "評価を実行"}
          </button>
          {error && <div className="response">⚠️ {error}</div>}
        </div>

        <div className="card">
          <h2>出力</h2>
          <p>
            seedごとの結果が配列で返ります。モデル出力はJSONのみの想定です。必要に応じて整形したJSONを
            コピーしてください。
          </p>
          <div className="response">
            {output || "まだ実行されていません。"}
          </div>
        </div>
      </section>
    </main>
  );
}
