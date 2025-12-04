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
function NiggurathChallengeClass(config) {
    this.LocalChallenge = null;
    if (!config) config = {};
    if (!config.HashFunction) throw new Error("[Niggurath] HashFunction is required in config");
    if (!config.RequestHeader && !config.UserID) throw new Error("[Niggurath] Request or UniqueID is required in config");
    this.getUserID = (reqHeaders) => {
        const realip = reqHeaders.get("CF-Connecting-IP") || reqHeaders.get("X-Forwarded-For") || reqHeaders.get("X-Real-IP") || "null";
        const ua = reqHeaders.get("User-Agent") || "null";
        return config.HashFunction(config.HashFunction(realip) + ":" + config.HashFunction(ua));
    }
    if (!config.UserID && !!config.RequestHeader) config.UserID = this.getUserID(config.RequestHeader);
    if (!config.TimeOut) config.TimeOut = 30;//默认30s过期
    this.config = config;

    this.initChallenge = (challengeLength) => {
        const ChallengeLength = challengeLength || 4;
        const SaltStr = randomGenerator(16, "Full");
        const ChallengeQuestion = config.HashFunction(config.UserID + ":" + SaltStr);
        const ChallengeAnswer = randomGenerator(ChallengeLength, "Number");
        // const ChallengeAnswer = "99999"
        const ChallengeToken = config.HashFunction(ChallengeQuestion + ":" + ChallengeAnswer);
        // console.log(`[Niggurath Debug] Generated Challenge - Question: ${ChallengeQuestion} | Token: ${ChallengeToken} | Length: ${ChallengeLength} | Answer: ${ChallengeAnswer}`);
        this.LocalChallenge = {
            ChallengeQuestion,
            ChallengeToken,
            ChallengeLength,
            ChallengeAnswer,
            ChallengeTimeOut: Date.now() + (config.TimeOut * 1000)
        }
        return this;
    }
    this.hasChallenge = () => this.LocalChallenge !== null;
    this.getChallenge = () => {
        if (!this.LocalChallenge) throw new Error("[Niggurath] Challenge not initialized");
        return {
            Question: this.LocalChallenge.ChallengeQuestion,
            Token: this.LocalChallenge.ChallengeToken,
            Length: this.LocalChallenge.ChallengeLength
        }
    }
    this.verifyChallenge = (ClientAnswer) => {
        if (!this.hasChallenge()) throw new Error("[Niggurath] Challenge not initialized");
        if (!ClientAnswer || Date.now() > this.LocalChallenge.ChallengeTimeOut) return false;
        return ClientAnswer === this.LocalChallenge.ChallengeAnswer && this.LocalChallenge.ChallengeToken === config.HashFunction(this.LocalChallenge.ChallengeQuestion + ":" + ClientAnswer);
    }
}

export default NiggurathChallengeClass;