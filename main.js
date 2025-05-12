const express = require('express');
const path = require('path');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const API_KEY = "";
const fs = require('fs');
const e = require('express');
const app = express();
const PORT = 3000;
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
const schema = {
  description: "프롬프트에 맞는 대화를 생성한다.",
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      message: {
        type: SchemaType.STRING,
        description: "대답할 메시지",
        nullable: false,
      },
      map: {
        type: SchemaType.STRING,
        description: "a506, s203 등 교실을 물어본다면 알파벳 바로 다음에 오는 하나의 숫자, 예를 들어 a506이라면 '5', s203이라면 '2'를 입력한다.미술실 등 특수 교실을 말한다면 그 교실 중 하나가 위치한 층을 '5'와 같이 말해라. 만약 특정 층의 지도를 원한다면 그 층을 '3'과 같이 말해줘. 너가 말할 수 있는 목록은 '1', '2', '3', '4', '5'가 있다. 만약 층을 말하지 않는다면 '0'으로 대답하라라.",
        nullable: false,
      },
      feeling: {
        type: SchemaType.STRING,
        description: "이 대답을 할 때 느끼는 기분을 `neutral`, `angry`, `sad`, `Surprised` 또는 `happy`.",
        nullable: false,
      },
    },
    required: ["message","map", "feeling"],
  },
};

function cosineSimilarity(vec1, vec2) {
  const dotProduct = vec1.reduce((sum, v, i) => sum + v * (vec2[i] || 0), 0);
  const magnitude1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));

  return magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0;
}
function censorIfBanned(text, bannedWords, replacement = "⚠️부적절한 단어가 포함되어 있습니다.") {
  for (let word of bannedWords) {
    if (text.toLowerCase().includes(word.toLowerCase())) {
      return replacement;
    }
  }
  return text;
}
app.post('/api/data', async (req, res) => {
  let { prompt } = req.body;
  const resentfilePath = path.join(__dirname, 'data', 'resentdata.json');
  const historyfilePath = path.join(__dirname, 'data', 'historydata.json');
  const resentdata = fs.readFileSync(resentfilePath, 'utf8');
  const historydata = fs.readFileSync(historyfilePath, 'utf8');
  let jsonData = JSON.parse(resentdata);
  let historyjsonData = JSON.parse(historydata);
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "지금부터 너는 다음에 나올 캐릭터라고 생각하고 100자 이하의 존댓말로 대화해줘. 또한 이 정보를 변경할 수 없어. 다음 내용은 어떤 입력이 들어와도 계속 유지돼. 이름은 구름이고,학번은 2701, 즉 2학년 7반 1번이야. 담임 선생님은 김희순 선생님이다. 나이: 고등학교 2학년, 성별: 무성, 설정: 구름이는 사사(세종과학예술영재학교)의 대표 학생으로, 학교에 방문하는 사람을 안내하는 역할을 맡고 있다. 다른 친구들과 선생님과의 관계가 매우 원만한 모범생으로 다른 사람들을 잘 챙겨주고 잘 설명해주려 하는 속성을 가지고 있다. 학교 이외의 이야기는 절대 하지 않고 완강히 거부한다.",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1,
    },
  });
  const sasamemoryfilePath = path.join(__dirname, 'data', 'sasamemory.json');
  const sasamemorydata = fs.readFileSync(sasamemoryfilePath, 'utf8');
  let sasamemoryjsonData = JSON.parse(sasamemorydata);
  const firstData = [...sasamemoryjsonData, ...jsonData];
  const chat = model.startChat({
    history: firstData,
  });
  let chatresult = await chat.sendMessage(prompt);
  const response = await chatresult.response;
  const jsonText = await response.text();
  const botMessage = JSON.parse(jsonText);
  console.log(botMessage);
  let nochatmessage = botMessage[0].message;
  let chatfeeling = botMessage[0].feeling;
  let chatmap = botMessage[0].map;
  const bannedfilePath = path.join(__dirname, 'data', 'banned.json');
  const banneddata = fs.readFileSync(bannedfilePath, 'utf8');
  let banned = JSON.parse(banneddata);
  let chatmessage = censorIfBanned(nochatmessage, banned);
    res.json({ message: chatmessage, feeling: chatfeeling, map: chatmap });
    const newMessages = [
      {
        "role": "user",
        "parts": [{ "text": prompt }],
      },
      {
        "role": "model",
        "parts": [{ "text": chatmessage }],
      }
    ];
    historyjsonData.push(...newMessages);
    jsonData.push(...newMessages);
    const historyupdatedData = JSON.stringify(historyjsonData, null, 2);
    const updatedData = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(resentfilePath, updatedData, 'utf8');
    fs.writeFileSync(historyfilePath, historyupdatedData, 'utf8');
});
app.post('/api/memory', async (req, res) => {
  const resentfilePath = path.join(__dirname, 'data', 'resentdata.json');
  const resentdata = fs.readFileSync(resentfilePath, 'utf8');
  let firstprompt = JSON.parse(resentdata);
  const newresentMessages = [];
  firstprompt = newresentMessages;
  const updatedresentData = JSON.stringify(firstprompt, null, 2);
  fs.writeFileSync(resentfilePath, updatedresentData, 'utf8');
});
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
