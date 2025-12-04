const NiggurathWorkerScript = `
onmessage = async (event) => {
    const { type, question, token, length } = event.data;
    if (type !== 'solve') { _postMessage({ type: 'error', error: 'Unknown message type' }); return; }
    const percentSegment = Math.floor(10 ** length / 100);
    for (let i = 0; i < 10 ** length; i++) {
        const attempt = i.toString().padStart(length.toString().length, '0');
        const attemptHash = await HashFunction(question + ":" + attempt);
        if (i % percentSegment === 0) _postMessage({ type: 'progress', progress: Math.floor(i / percentSegment) ,attempt: attempt, attemptHash: attemptHash});
        if (attemptHash === token) {
            _postMessage({ success: true, type: 'result', answer: attempt, token: attemptHash });
            return;
        }
    }
    _postMessage({ success: false, type: 'error', error: 'No valid answer found' });
}
`


window.NiggurathFinder = function (config) {
    if (!config) config = {};
    if (!config.HashFunction) config.HashFunction = async (message) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message)))).map(b => b.toString(16).padStart(2, '0')).join('')
    this.onProgress = console.log
    this.solveChallenge = async (ChallengeQuestion, ChallengeToken, ChallengeLength) => {
        if (window.Worker && !config.ForceMainThread) {
            console.log("[NiggurathFinder] Using Web Worker for challenge solving.");
            const NiggurathWorker = new Worker(URL.createObjectURL(new Blob([NiggurathWorkerScript + `\nlet HashFunction = ${config.HashFunction.toString()};\nlet _postMessage = postMessage;`], { type: 'application/javascript' })));
            return new Promise((resolve, reject) => {
                NiggurathWorker.onmessage = (event) => {
                    if (event.data.type === 'result') {
                        resolve(event.data.answer);
                        NiggurathWorker.terminate();
                    } else if (event.data.type === 'error') {
                        reject(event.data.error);
                        NiggurathWorker.terminate();
                    } else {
                        this.onProgress(event.data);
                    }
                };
                NiggurathWorker.postMessage({
                    type: 'solve',
                    question: ChallengeQuestion,
                    token: ChallengeToken,
                    length: ChallengeLength
                });
            });
        } else {
            console.log("[NiggurathFinder] Web Worker not supported or disabled by config, using main thread for challenge solving.");

            return new Promise((resolve, reject) => {
                (async () => {
                    let onmessage = async (data) => { };
                    let HashFunction = config.HashFunction;
                    eval(NiggurathWorkerScript);
                    const _postMessage = (data) => {
                        if (data.type === 'result') {
                            resolve(data.answer);
                        } else if (data.type === 'error') {
                            reject(data.error);
                        } else {
                            this.onProgress(data);
                        }
                    }

                    await onmessage({
                        data: {
                            type: 'solve',
                            question: ChallengeQuestion,
                            token: ChallengeToken,
                            length: ChallengeLength
                        }
                    });
                })();
            });
        }
    }
}