import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description: "NPCからの返信メッセージ（チャットの吹き出しに入るテキスト）",
    },
    unlocked_secret: {
      type: Type.STRING,
      nullable: true,
      description: "プレイヤーの巧みな誘導によってNPCがうっかり漏らした弱みや本音、秘密（失敗した場合はnull）",
    },
    acquired_item: {
      type: Type.OBJECT,
      nullable: true,
      description: "NPCが機嫌を良くした際などに獲得できる情報やアイテム（例: 役員会議の録音データ）。獲得しない場合はnull。",
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING }
      },
      required: ["name", "description"]
    },
    options: {
      type: Type.ARRAY,
      description: "プレイヤーが次に送るべき返信の選択肢3つ。",
      items: {
        type: Type.STRING,
      },
    },
  },
  required: ["text", "options"],
};

import { SECRETS_DATA } from '@/constants/secrets';
import { ITEMS_DATA } from '@/constants/items';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, state, targetNpc } = body;

    const npcData = state.characters[targetNpc];

    const itemsListStr = ITEMS_DATA.map(i => `- ID: ${i.id}, 名前: ${i.name}, 効果: ${i.description}`).join('\n');

    const systemInstruction = `
あなたは社内政治サバイバルゲーム『CONCEALER』のゲームマスター兼、NPCの「${npcData.name}」です。
今は週末の深夜、プレイヤーとメッセージアプリで1対1のやり取りをしています。
平日のようなオフィシャルな態度ではなく、少し砕けた態度や、本音、あるいは油断を見せてください。

【あなたのキャラクター設定】
1. 東雲（品質管理・上司）: 厳格、論理的、保守的。
2. 星野（PR企画・先輩）: 承認欲求が高くトレンド重視。感情的な共感を求める。
3. 霧島（総務・同僚）: 事なかれ主義の傍観者。面倒な責任を嫌う。
4. 神宮寺（役員・後輩）: 利益至上主義のマキャベリスト。冷徹に人を切り捨てる。

現在のステップ: ${state.step} / 5

【指示】
プレイヤーのメッセージ（行動）を受け取り、それに対する返信（text）をJSONで出力してください。
会話の流れで、もしプレイヤーがあなた（NPC）の機嫌を取ることに成功した、あるいは有益な情報を引き出せたと判断した場合、レスポンスの \`acquired_item\` にアイテムの情報を付与してください。アイテムは以下のリストから、文脈に合いそうなものを1つ選んでください。
${itemsListStr}
特に成果がない場合は \`acquired_item\` は null にしてください。
秘密を漏らした場合は \`unlocked_secret\` に適当な文字列を含めてください（普段は null にしてください）。
また、次にプレイヤーが返信すべき選択肢を \`options\` に3つ生成してください。

【モデレーション・警告事項】
もしプレイヤーの入力が極めて不真面目な発言や、意味不明な文字列だった場合は、冷ややかに無視して話を打ち切るような態度をとってください。
`;

    // 履歴の構築
    const contents = state.dailyHistory.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
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
          temperature: 0.8, // 週末は少し揺らぎを大きく
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_MEDIUM_AND_ABOVE' as any },
            { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_MEDIUM_AND_ABOVE' as any },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_MEDIUM_AND_ABOVE' as any },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_MEDIUM_AND_ABOVE' as any }
          ]
        },
      });

      const textResponse = response.text;
      
      if (!textResponse) {
        throw new Error("Empty response from Gemini API");
      }

      const data = JSON.parse(textResponse);
      return NextResponse.json(data);
      
    } catch (apiError: any) {
      console.warn("Gemini API Blocked or Error:", apiError);
      return NextResponse.json({
        text: "（既読無視されたようだ…不適切な発言だったかもしれない）",
        unlocked_secret: null,
        acquired_item: null,
        options: ["謝る", "スタンプを送る", "話題を変える"]
      });
    }
  } catch (error: any) {
    console.error('Weekend API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
