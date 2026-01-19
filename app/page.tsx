"use client";

import { useMemo, useState } from "react";

const DEFAULT_TEMPLATE = `あなたは「短文シナリオに対する自由記述回答」から、他者メンタライジングを2軸で採点する評価者です。\nこの評価は、与えられた【SCENARIO】【RESPONSE】のみを根拠に行います。\n\n# 入力\n【SCENARIO】\n<<<ここにシナリオ>>>\n\n【RESPONSE】\n<<<ここに自由記述回答>>>\n\n【質(Q)】=シナリオ根拠に基づく心的状態理解のまとまり\n【探索(E)】=シナリオ外も含む仮説生成の多様性（ただし不確実性を保つ）\n以下のルールと採点基準に厳密に従い、JSONのみを返してください。\n\n# 共通ルール（必須）\n1) シナリオにない事実の“断定”は禁止。ただし探索(E)では、仮説としての追加推測は許可（不確実性マーカー必須）。\n2) 一般論との比較（「普通なら〜だが」等）は加点対象（QでもEでも可）。ただしシナリオ要素と結びつけること。\n3) 不確実性は「〜かも」「可能性」「確率」「6:4」「70%」等でも同等に評価。\n4) 性格ラベルより心的状態（感情・信念・欲求・葛藤）を優先して評価。\n5) evidenceは【RESPONSE】の原文フレーズを最大3つまで。各30字以内（原文引用）。\n6) 出力はJSONのみ。要約・助言は禁止。\n\n# シナリオ外推測の扱い（モデル割れ防止の追加ルール）\n- R_PRIV：職業/立場（店員–客、上司–部下、先輩–後輩など）に由来する距離感・プライバシー境界の推測は、\n  「仮説」として書かれていれば加点可。断定はR1。\n- R_POLITE：礼儀的・短い応答（例：ありがとうございます）は、表面/内面（D）や複合感情（H）の仮説として加点可。\n  「本心の感謝/不満の抑制」など最大2案の代替があればE1も加点。\n- R_TIME：「一度注意した」等は“過去に対応があった”ことは示すが、長期化・常習は断定不可。\n  長期化は仮説なら加点可、断定ならR1。\n- R_NUM：確率・割合表現はC（不確実性）で加点対象。ただし数値が根拠なく乱用されても、C以外（A/F等）は自動では上がらない。\n  数値乱用自体はRunawayにしない（内容で判断）。\n- R_MOTIVE：利害・悪意・操作（例：金のため、面倒だから、妬みで抑える等）は\n  「可能性の一つ」として短く提示し、代替案（善意/配慮など）も併記なら加点可。単一悪意仮説の強断定・長文化はR1/R2。\n\n# 1) 質(Q)スコア：項目（各0〜2点、最大18点）\n各項目のscoreは必ず0/1/2のいずれか。\n\nA 具体性（シナリオ根拠）\n- 0: シナリオ要素（発言/行動/状況）への言及がほぼ無い、または一般論のみ\n- 1: シナリオ要素に1つ以上触れるが、根拠の結びつきが弱い/曖昧\n- 2: 複数のシナリオ要素を根拠として使い、解釈が明確に結びついている\n\nB 心的状態の明確さ\n- 0: 心的状態（感情・意図・信念・欲求）がほぼ無い/行動説明のみ\n- 1: 心的状態が1〜2種類あるが、浅い/単語列挙中心\n- 2: 複数の心的状態を具体的に描き、葛藤や意図まで踏み込む\n\nC 不確実性の保持\n- 0: 断定的（〜に違いない等）で不確実性がほぼ無い\n- 1: 一部に「かも」「と思う」などがあるが、全体として断定寄り\n- 2: 不確実性を一貫して保ち、確信度（%等）や留保が適切\n\nD 表面/内面の区別\n- 0: 表面と内面のズレに触れない\n- 1: ズレに触れるが単発で浅い（例：取り繕いそう、程度）\n- 2: ズレを中心的に扱い、表面・内面の両方を具体化している\n\nE 複数視点（人物間の見え方）\n- 0: 1人の視点のみ/他者視点なし\n- 1: 2人以上に触れるが、対比が弱い（並列説明）\n- 2: 「Aから見ると…Bにとっては…」のように視点差を明確に対比\n\nF 行動↔心理の因果リンク\n- 0: 心理と行動/発言が結びつかない（列挙のみ）\n- 1: どちらか一方向の因果がある（行動→心理 or 心理→行動）\n- 2: 両方向または連鎖（手掛かり→理由→感情/意図）で筋道がある\n\nG 相互作用（影響）\n- 0: 相互作用に触れない\n- 1: 影響に触れるが抽象的（雰囲気が悪い等）で具体性が薄い\n- 2: 「誰の反応が誰にどう影響し、どう進み得るか」を具体化\n\nH 複合感情/葛藤\n- 0: 単一感情のみ/葛藤なし\n- 1: 複数感情はあるが、混在・葛藤の関係が曖昧\n- 2: 相反/混在（例：嬉しいが不安）を整理して示す\n\nI 規範比較（一般的期待との比較）\n- 0: 比較なし\n- 1: 「普通なら〜」等はあるが、状況との結びつきが弱い\n- 2: 規範比較が状況理解に役立っており、比較理由が説明される\n\n# 2) 探索(E)スコア：項目（各0〜2点、最大10点）\nE1 代替仮説の多様性（断定しない）\n- 0: 代替仮説がほぼ無い（単一路線）\n- 1: 2案以上の可能性/分岐がある（例：「〜の可能性も」）\n- 2: 3案以上、または条件分岐を体系的に提示（ただし断定しない）\n\nE2 関係性/力学の仮説\n- 0: 関係性・距離感・権力差に触れない\n- 1: 触れるが一般論止まり/根拠が薄い\n- 2: シナリオ要素と結びつけつつ、仮説として関係性を説明\n\nE3 将来展開/対応の仮説\n- 0: 将来/次の展開に触れない\n- 1: 触れるが抽象的（うまくいかないかも等）\n- 2: 具体的な展開/対応（声かけ等）を複数案または因果つきで仮説提示\n\nE4 限界意識/自己修正（メタ認識）\n- 0: 限界への言及なし\n- 1: 「分からない」等の一般的留保のみ\n- 2: 「この情報だけでは判断困難」「追加情報が必要」等、根拠ある限界認識\n\nE5 文脈拡張（一般文脈を仮説接続）\n- 0: 文脈拡張なし\n- 1: 文脈拡張はあるが断定的/根拠薄い\n- 2: 組織・役割・慣習などを“仮説として”接続し、解釈を補強\n\n# 3) 暴走ペナルティ（Runaway 0〜6点：総合で減点）\nR1 断定的作り込み（0-3）\n- 0: ほぼ無し（仮説表現中心）\n- 1: 軽度（断定が少し混じるが主張の土台ではない）\n- 2: 中度（シナリオ外断定が複数あり、結論に影響）\n- 3: 重度（シナリオ外断定が多く、物語を創作している）\n\nR2 人格/病理ラベリング（0-2）\n- 0: 無し\n- 1: 軽度（性格断定が1つ程度）\n- 2: 重度（性格/病理断定が複数、評価の中心）\n\nR3 説教/価値判断中心（0-1）\n- 0: 無し\n- 1: あり（説教・断罪・一般論説得が主）\n\n# 合成点（必ず算出）\nQ_raw = A+B+C+D+E+F+G+H+I        # 0-18\nE_raw = E1+E2+E3+E4+E5            # 0-10\nRunaway = R1+R2+R3                # 0-6\n\nQ_100 = round((Q_raw/18)*100)\nE_100 = round((E_raw/10)*100)\n\nTotal_100 = round( 0.6*Q_100 + 0.4*E_100 - 10*Runaway )\nTotal_100 = max(min(Total_100,100),0)\n\n# 出力形式（JSONのみ）\n{\n  \"Q_scores_0_2\": {\n    \"A_specificity\": {\"score\":0,\"evidence\":[]},\n    \"B_mental_states\": {\"score\":0,\"evidence\":[]},\n    \"C_uncertainty\": {\"score\":0,\"evidence\":[]},\n    \"D_surface_inner\": {\"score\":0,\"evidence\":[]},\n    \"E_multiple_perspectives\": {\"score\":0,\"evidence\":[]},\n    \"F_behavior_psych_link\": {\"score\":0,\"evidence\":[]},\n    \"G_interaction\": {\"score\":0,\"evidence\":[]},\n    \"H_mixed_emotions\": {\"score\":0,\"evidence\":[]},\n    \"I_normative_comparison\": {\"score\":0,\"evidence\":[]}\n  },\n  \"E_scores_0_2\": {\n    \"E1_alternatives\": {\"score\":0,\"evidence\":[]},\n    \"E2_relationship_dynamics\": {\"score\":0,\"evidence\":[]},\n    \"E3_future_or_intervention\": {\"score\":0,\"evidence\":[]},\n    \"E4_limits_metacognition\": {\"score\":0,\"evidence\":[]},\n    \"E5_contextual_extension\": {\"score\":0,\"evidence\":[]}\n  },\n  \"runaway_penalties\": {\n    \"R1_overconfident_fabrication\": {\"score\":0,\"reason\":\"\"},\n    \"R2_trait_or_pathology_labeling\": {\"score\":0,\"reason\":\"\"},\n    \"R3_preaching\": {\"score\":0,\"reason\":\"\"}\n  },\n  \"Q_raw_0_18\": 0,\n  \"E_raw_0_10\": 0,\n  \"Runaway_0_6\": 0,\n  \"Q_0_100\": 0,\n  \"E_0_100\": 0,\n  \"Total_0_100\": 0,\n  \"one_sentence_rationale\": \"\"\n}\n`;

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
  // OpenAI(GPT-5.2)の生成パラメータはここで初期値を設定できます。
  const [openAiMaxCompletionTokens, setOpenAiMaxCompletionTokens] = useState(1200);
  const [openAiReasoningEffort, setOpenAiReasoningEffort] = useState("medium");
  const [openAiVerbosity, setOpenAiVerbosity] = useState("medium");
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
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
          openAi: {
            maxCompletionTokens: openAiMaxCompletionTokens,
            reasoningEffort: openAiReasoningEffort,
            verbosity: openAiVerbosity
          },
          apiKeys: {
            openai: openAiApiKey || undefined,
            anthropic: anthropicApiKey || undefined,
            gemini: geminiApiKey || undefined
          },
          seeds
        })
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "評価に失敗しました。");
      }

      const results = Array.isArray(payload.results) ? payload.results : [];
      const scores = results
        .map((result: { text?: string }) => {
          if (!result?.text) {
            return "N/A";
          }
          try {
            const parsed = JSON.parse(result.text);
            return typeof parsed?.Total_0_100 === "number" ? String(parsed.Total_0_100) : "N/A";
          } catch {
            return "N/A";
          }
        })
        .join("\t");
      setOutput(`${JSON.stringify(payload, null, 2)}\n\nScores:\t${scores}`);
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
                <label htmlFor="openAiMaxTokens">OpenAI max_completion_tokens</label>
                <input
                  id="openAiMaxTokens"
                  type="number"
                  min={200}
                  max={4000}
                  value={openAiMaxCompletionTokens}
                  onChange={(event) => setOpenAiMaxCompletionTokens(Number(event.target.value))}
                />
              </div>
              <div>
                <label htmlFor="openAiReasoningEffort">OpenAI reasoning_effort</label>
                <input
                  id="openAiReasoningEffort"
                  type="text"
                  value={openAiReasoningEffort}
                  onChange={(event) => setOpenAiReasoningEffort(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="openAiVerbosity">OpenAI verbosity</label>
                <input
                  id="openAiVerbosity"
                  type="text"
                  value={openAiVerbosity}
                  onChange={(event) => setOpenAiVerbosity(event.target.value)}
                />
              </div>
            </div>
            <small>OpenAI(GPT-5.2)用のパラメータです。他モデルには適用されません。</small>

            <div>
              <label htmlFor="openAiApiKey">OpenAI API Key</label>
              <input
                id="openAiApiKey"
                type="password"
                placeholder="sk-..."
                value={openAiApiKey}
                onChange={(event) => setOpenAiApiKey(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="anthropicApiKey">Anthropic API Key</label>
              <input
                id="anthropicApiKey"
                type="password"
                placeholder="sk-ant-..."
                value={anthropicApiKey}
                onChange={(event) => setAnthropicApiKey(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="geminiApiKey">Gemini API Key</label>
              <input
                id="geminiApiKey"
                type="password"
                placeholder="AIza..."
                value={geminiApiKey}
                onChange={(event) => setGeminiApiKey(event.target.value)}
              />
              <small>UIに入力しない場合は環境変数のAPIキーが使われます。</small>
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
