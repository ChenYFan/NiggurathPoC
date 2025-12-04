import Crypto from 'crypto';
//或者使用crypto-js，这样能够允许在不开机nodejs兼容性情况下使用Niggurath
import NiggurathChallengeClass from './Niggurath.js';

const HashFunction = (data) => Crypto.createHash('sha256').update(data).digest('hex');
let GlobalChallenge = null;
//定义一个GlobalChallenge用于存储NiggurathChallengeClass实例


let GlobalCounter = 0;




export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/")) {
            const action = url.pathname.replace("/api/", "");
            switch (action) {

                case 'GetChallenge':
                    const LocalChallenge = new NiggurathChallengeClass({
                        HashFunction,
                        RequestHeader: request.headers
                    });
                    GlobalChallenge = LocalChallenge.initChallenge(5);
                    return new Response(JSON.stringify(GlobalChallenge.getChallenge()));



                case 'MockLogin':
                    if (!GlobalChallenge || !GlobalChallenge.hasChallenge()) {
                        return new Response(JSON.stringify({
                            success: false,
                            message: "No challenge initialized",
                            code: 4001
                        }), { status: 400 });
                    }

                    //从body中获取模拟登录数据
                    const requestBody = await request.json();
                    const VerifyResult = GlobalChallenge.verifyChallenge(request.headers.get("N-Challenge-Answer"));
                    GlobalChallenge = null;
                    const LoginResult = (requestBody.username === "CyanFalse" && requestBody.password === "1145141919810");


                    return new Response(JSON.stringify({
                        success: VerifyResult && LoginResult,
                        message: VerifyResult ? (LoginResult ? "Login successful" : "Invalid username or password") : "Challenge verification failed",
                        code: VerifyResult ? (LoginResult ? 2000 : 4002) : 4003
                    }), { headers: { 'Content-Type': 'application/json' } });




                case 'GlobalCounter': // 简单的全局计数器示例
                    GlobalCounter += 1;
                    return new Response(JSON.stringify({ counter: GlobalCounter }));
                default:
                    return new Response('Not Found', { status: 404 });

            }
        }
        //对任何非api请求，在之前加上/raw/以获取真实静态资源（否则会被Page强制托管导致无法修改标头）
        const modifiedStaticRequest = new Request(request.url.replace(url.origin, url.origin + "/raw"));
        const rawStaticResponse = await env.ASSETS.fetch(modifiedStaticRequest);
        //如果标头包含content-type为text/html，则修改为text/html; charset=utf-8
        const contentType = rawStaticResponse.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
            const modifiedHeaders = new Headers(rawStaticResponse.headers);
            modifiedHeaders.set('content-type', 'text/html; charset=utf-8');
            return new Response(rawStaticResponse.body, {
                status: rawStaticResponse.status,
                statusText: rawStaticResponse.statusText,
                headers: modifiedHeaders
            });
        }
        return rawStaticResponse;
    }
};
