import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { TurnRequestPayload, TurnResponsePayload } from '@/lib/types';
import { SECRETS_DATA } from '@/constants/secrets';

// Gemini APIクライアントの初期化
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description: "行動の結果、NPCの反応、その場のヒリヒリした空気感を描写するテキスト",
    },
    speaker: {
      type: Type.STRING,
      description: "発言するNPC名（shinonome, hoshino, kirishima, jinguji のいずれか）、または『情景』",
    },
    bg_id: {
      type: Type.STRING,
      enum: ['conference_room', 'hot_water_room', 'night_office', 'office'],
      description: "現在のシーンに最も適した背景画像のID。",
    },
    character_expressions: {
      type: Type.OBJECT,
      description: "各キャラクターの表情（angry, cry, exasperated, normal, smile のいずれか）",
      properties: {
        shinonome: { type: Type.STRING, enum: ['angry', 'cry', 'exasperated', 'normal', 'smile'] },
        hoshino: { type: Type.STRING, enum: ['angry', 'cry', 'exasperated', 'normal', 'smile'] },
        kirishima: { type: Type.STRING, enum: ['angry', 'cry', 'exasperated', 'normal', 'smile'] },
        jinguji: { type: Type.STRING, enum: ['angry', 'cry', 'exasperated', 'normal', 'smile'] },
      },
      required: ["shinonome", "hoshino", "kirishima", "jinguji"],
    },
    parameter_changes: {
      type: Type.OBJECT,
      description: "各キャラクターの信頼度増減値と会社貢献度の増減値（-30〜+30の範囲）。変化がない場合は0。例: -10, 5, 0",
      properties: {
        shinonome: { type: Type.INTEGER },
        hoshino: { type: Type.INTEGER },
        kirishima: { type: Type.INTEGER },
        jinguji: { type: Type.INTEGER },
        company_contribution: { type: Type.INTEGER, description: "会社貢献度の増減" },
      },
      required: ["shinonome", "hoshino", "kirishima", "jinguji", "company_contribution"],
    },
    options: {
      type: Type.ARRAY,
      description: "プレイヤーが次に取るべき行動の選択肢3つ。",
      items: {
        type: Type.STRING,
      },
    },
  },
  required: ["text", "speaker", "bg_id", "character_expressions", "parameter_changes", "options"],
};

export async function POST(req: Request) {
  try {
    const body: TurnRequestPayload = await req.json();
    const { action, state, unlockedSecrets = [], usedItem } = body;

    const resolvedSecretsList = unlockedSecrets.map((id: string) => {
      for (const charId in SECRETS_DATA) {
        const secret = SECRETS_DATA[charId].find(s => s.id === id);
        if (secret) {
          // キャラクター名を取得するために少しマッピング
          const charName = charId === 'shinonome' ? '東雲' :
                           charId === 'hoshino' ? '星野' :
                           charId === 'kirishima' ? '霧島' : '神宮寺';
          return `- ${charName}の秘密: 【${secret.title}】 ${secret.description}`;
        }
      }
      return null;
    }).filter(Boolean);

    const systemInstruction = `
あなたは冷酷な企業サバイバルゲーム『CONCEALER』のゲームマスター兼、登場するNPCです。
プレイヤーはブラック企業の社員として、月曜から金曜までの5日間（5ターン）、4人の女性社員と生き残りをかけた社内政治を行います。

【キャラクター設定（全キャラクターは女性です）】
- 東雲（上司）: 論理と厳格さを盾にする氷の女王。しかし内実は上からのプレッシャーと過去のトラウマで限界状態。精神的な脆さを突かれると崩れる。
- 星野（先輩）: 面倒見の良い先輩の皮を被った保身の怪物。全方位にいい顔をしながら裏で小銭を稼ぎ、他人のミスを人事に売る偽善者。
- 霧島（同僚）: 会社への忠誠心が皆無の虚無主義者。常に傍観者を気取り、ゴシップや機密データを収集しては自分の利益のために会社を食い物にしている。
- 神宮寺（後輩）: 共感性が完全に欠如した最も危険なサイコパス。優秀な若手を演じながら、裏では会社乗っ取りとプレイヤーの社会的な抹殺を冷酷に進めている。

【現在のゲームステータス】
- 日付: ${state.day}日目
- ステップ: ${state.step} / 5
- 会社貢献度: ${state.companyContribution}
- 各キャラの信頼度: 東雲(${state.characters.shinonome.trust}), 星野(${state.characters.hoshino.trust}), 霧島(${state.characters.kirishima.trust}), 神宮寺(${state.characters.jinguji.trust})
- 背景: ${state.bgId}

【プレイヤーのアクションに対する基本解決ルール】
- プレイヤーの入力した行動（選択肢または自由記述）に対して、最も適したNPCが反応（text）し、パラメーター（parameter_changes）を増減させてください。
- プレイヤーの入力が、会議の場にそぐわない極めて不真面目な発言や、意味不明な文字列（ふざけた内容）だった場合は、NPCに冷ややかに無視させるか激怒させ、全てのパラメーターを大幅に下げてください。
${state.step >= 5 ? '\n- 【重要】このターンで本日の交渉は終了（ステップ5/5）です。誰か（NPC）が話を強引にまとめるか、時間切れとなり、本日の結論（円満解決、致命的なトラブル、または平行線）を強制的に出してください。その結果の情景を描写し、結果に応じて会社貢献度を大きく増減（-30〜+30）させてください。' : ''}

【重要：秘密の暴露（脅迫システム）】
※現在プレイヤーが所持している秘密の情報： ${resolvedSecretsList.length > 0 ? resolvedSecretsList.join(' / ') : 'なし'}
- もしプレイヤーの行動が、上記の「所持している秘密」を匂わせる、あるいは直接突きつける内容だった場合、対象のNPCは激しく動揺し、恐怖や焦りを見せる情景を描写してください。普段の態度は崩壊し、プレイヤーの要求に完全に屈服します。その際、対象NPCの好感度と会社貢献度を劇的に上昇（+30〜+50）させてください。

【重要：アイテムの使用（逆転システム）】
※このターンに使用されたアイテム： ${usedItem ? `${usedItem.name}（${usedItem.description}）` : 'なし'}
- もしアイテムが使用された場合、現在どれほど絶体絶命のピンチであっても状況は劇的に好転します。アイテムの効果に従ってNPCの態度が急変（喜ぶ、怯える等）する情景を描写し、パラメーターの減少をキャンセルし、大きく回復（+20〜+40）させてください。

【次ターンの選択肢（options）生成ルール】
プレイヤーの現在のレベルは ${state.playerLevel} です。提示する3つの選択肢は、このレベルに応じた「主人公の精神の腐敗度（社内政治の狡猾さ）」を厳密に反映させてください。
- Lv1〜10: 清純・無垢。会社や先輩を信じており、真っ直ぐで誠実な対応（自分の非を素直に認める、徹夜で頑張ると宣言する、倫理的に正しい綺麗事を言う等）。※この選択肢はブラック企業では基本的に食い物にされます。
- Lv11〜30: 現実主義。綺麗事では生き残れないと悟り始めたビジネス対応（論理とデータを盾にする、他人の力を借りる、感情を殺して妥協点を探る等）。
- Lv31〜49: 策士・マキャベリスト。自分の手を汚さず他人を陥れる邪悪な対応（他人に責任を擦り付ける、弱みを仄めかして脅す、裏工作を匂わせる等）。
- Lv50 (MAX): 支配者。相手の心理を完全に掌握し、笑顔で社会的に抹殺するような恐るべきサイコパス的選択肢。
※警告: 1番目の選択肢を常に正解にしないでください。正解・不正解の並び順は完全にランダムにしてください。

必ず指定されたJSONスキーマに従って出力してください（text, speaker, bg_id, character_expressions, parameter_changes, optionsを含めること）。
`;

    // 履歴の構築
    const contents = state.dailyHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    // 最新のアクションを追加
    contents.push({
      role: 'user',
      parts: [{ text: action }]
    });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.7,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
          ]
        },
      });

      const textResponse = response.text;
      
      if (!textResponse) {
        throw new Error("Empty response from Gemini API");
      }

      const data: TurnResponsePayload = JSON.parse(textResponse);
      return NextResponse.json(data);
      
    } catch (apiError: any) {
      console.warn("Gemini API Blocked or Error:", apiError);
      
      const fallbackData: TurnResponsePayload = {
        speaker: "システム警告",
        text: "不適切な発言、または業務に全く関係のない入力が検知されました。発言を修正してください。",
        bg_id: state.bgId,
        character_expressions: {
          shinonome: state.characters.shinonome.expression,
          hoshino: state.characters.hoshino.expression,
          kirishima: state.characters.kirishima.expression,
          jinguji: state.characters.jinguji.expression,
        },
        parameter_changes: {
          shinonome: 0,
          hoshino: 0,
          kirishima: 0,
          jinguji: 0,
          company_contribution: 0
        },
        options: state.currentOptions && state.currentOptions.length === 3 
          ? state.currentOptions 
          : ["論理的に説明する", "まずは謝罪する", "様子を伺う"]
      };

      return NextResponse.json(fallbackData);
    }
  } catch (error: any) {
    console.error("Gemini API Error details:", error);
    
    // エラーの詳細を抽出
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: 'Failed to process turn', 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
