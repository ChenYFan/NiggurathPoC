import Crypto from 'crypto';

const SHA256 = (data) => Crypto.createHash('sha256').update(data).digest('hex');
const randomGenerator = (length, type) => {
	const CharTable = {
		"Full": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
		"Number": "0123456789",
		"Hex": "abcdef0123456789"
	}
	let result = '';
	const characters = CharTable[type] || CharTable["Full"];
	const charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}
let GlobalCounter = 0;
let GlobalChallenge = null

function NiggurathChallengeClass() {
	this.LocalChallenge = null;
	this.init = (reqHeaders, challengeLength) => {
		const UniqueID = this.genUniqueID(reqHeaders); // 用UA和IP来限定客户端
		const SaltStr = randomGenerator(16, "Full"); //加盐
		const ChallengeLength = challengeLength || 6; //长度
		const ChallengeAnswer = randomGenerator(ChallengeLength, "Number");
		const UniqueQuestion = SHA256(UniqueID + ":" + SaltStr);
		const UniqueChallenge = SHA256(UniqueQuestion + ":" + ChallengeAnswer);
		this.LocalChallenge = {
			UniqueID,
			SaltStr,
			UniqueQuestion,
			UniqueChallenge,
			ChallengeLength,
			ChallengeAnswer,
		}
		return this;
	}
	this.genUniqueID = (reqHeaders) => {
		const realip = reqHeaders.get("CF-Connecting-IP") || reqHeaders.get("X-Forwarded-For") || reqHeaders.get("X-Real-IP") || "null";
		const ua = reqHeaders.get("User-Agent") || "null";
		return SHA256(SHA256(realip) + ":" + SHA256(ua));
	}
	this.getChallenge = () => {
		return {
			UniqueQuestion: this.LocalChallenge.UniqueQuestion,
			UniqueChallenge: this.LocalChallenge.UniqueChallenge,
			ChallengeLength: this.LocalChallenge.ChallengeLength
		}
	}
	this.verify = (reqHeaders) => {
		const ClientChanllenge = reqHeaders.get("n-Challenge-Token") || null;
		const ClientAnswer = reqHeaders.get("n-Challenge-Answer") || null;
		if (!ClientChanllenge
			|| !ClientAnswer
			|| ClientChanllenge !== this.LocalChallenge.UniqueChallenge) return false;
		console.log("校验通过，开始验证答案");
		console.log("ClientAnswer:", ClientAnswer, " | RealAnswer:", this.LocalChallenge.ChallengeAnswer);
		return ClientAnswer === this.LocalChallenge.ChallengeAnswer && ClientChanllenge === SHA256(this.LocalChallenge.UniqueQuestion + ":" + this.LocalChallenge.ChallengeAnswer);
		//防止前向泄露
	}
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (url.pathname.startsWith("/api/")) {
			const action = url.pathname.replace("/api/", "");
			switch (action) {
				case 'GlobalCounter':
					GlobalCounter += 1;
					return new Response(JSON.stringify({ counter: GlobalCounter }), {
						headers: { 'Content-Type': 'application/json' },
					});
				case 'GetChallenge':
					const LocalChallenge = new NiggurathChallengeClass();
					GlobalChallenge = LocalChallenge.init(request.headers, 5);
					return new Response(JSON.stringify(GlobalChallenge.getChallenge()), {
						headers: { 'Content-Type': 'application/json' },
					});
				case 'MockLogin':
					if (!GlobalChallenge) {
						return new Response(JSON.stringify({
							success: false,
							message: "No challenge initialized",
							code: 4001
						}), { status: 400 });
					}

					//从body中获取模拟登录数据
					const requestBody = await request.json();
					const LoginResult = (requestBody.username === "CyanFalse" && requestBody.password === "1145141919810");

					const VerifyResult = GlobalChallenge.verify(request.headers);
					GlobalChallenge = null;
					return new Response(JSON.stringify({
						success: VerifyResult && LoginResult,
						message: VerifyResult ? (LoginResult ? "Login successful" : "Invalid username or password") : "Challenge verification failed",
						code: VerifyResult ? (LoginResult ? 2000 : 4002) : 4003
					}), { headers: { 'Content-Type': 'application/json' } });
				default:
					return new Response('Not Found', { status: 404 });

			}
		}
		return new Response(await (await env.ASSETS.fetch(new Request("http://127.0.0.1/test.html"))).arrayBuffer(),
			{ status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8', "CyanAdd": "Add" } });
	},
};
