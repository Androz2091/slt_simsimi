const { FbnsClient } = require("instagram_mqtt");
const { IgApiClient } = require("instagram-private-api");
const { promisify } = require("util");
const { writeFile, readFile, exists } = require("fs");

const { username, password, key, lang, atext_bad_prob_max } = require("./config");
const simsimi = require("simsimi")({ key, lang, atext_bad_prob_max });

const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);
const existsAsync = promisify(exists);

const ig = new IgApiClient();
ig.state.generateDevice(username);
const fbnsClient = new FbnsClient(ig);

/**
 * Send a dm to a specific user
 * @param {string} username The name of the user
 * @param {string} content The content of the message to send
 */
const sendDMTo = async (username, content) => {
    let userId = await ig.user.getIdByUsername(username);
    let thread = ig.entity.directThread([userId.toString()]);
    await thread.broadcastText(content);
};

(async () => {

    // Set the auth and the cookies for instagram
    await readState(ig, fbnsClient);
    // Logs the client in
    await loginToInstagram(ig, fbnsClient);
        
    // Listen direct message
    fbnsClient.on("direct_v2_message", async (data) => {
        let author = data.message.split(":")[0];
        let content = data.message.split(":").slice(1, data.message.split(":").length).join(":");
        content = content.substr(1, content.length);
        let answer = await simsimi(content).catch(console.error);
        sendDMTo(author, answer || "Hmm... une erreur est survenue 😕").catch((e) => {
            // Approve all requests
            const items = await ig.feed.directPending().items();
            items.forEach(async (item) => await ig.directThread.approve(item.thread_id));
        });
        console.log("[USER] "+author+" : "+content)
        console.log("[ ME ] slt_simsimi : "+answer || "Hmm... une erreur est survenue 😕");
    });

    fbnsClient.on("auth", async (auth) => {
        await saveState(ig, fbnsClient);
    });

    await fbnsClient.connect();

    console.log("[!] Bot is ready");

})();

/* Normal saving of cookies for the instagram-api */
async function saveState(ig, fbns) {
    const cookies = await ig.state.serializeCookieJar();
    return writeFileAsync("state.json", JSON.stringify({
        cookies: JSON.stringify(cookies),
        state: {
            deviceString: ig.state.deviceString,
            deviceId: ig.state.deviceId,
            uuid: ig.state.uuid,
            phoneId: ig.state.phoneId,
            adid: ig.state.adid,
            build: ig.state.build,
        },
        fbnsAuth: fbns.auth.toString(),
    }), { encoding: "utf8" });
}

/* Normal reading of state for the instagram-api */
async function readState(ig, fbns) {
    if (!await existsAsync("state.json")) return;
    // 
    const { cookies, state, fbnsAuth } = JSON.parse(await readFileAsync("state.json", { encoding: "utf8" }));
    ig.state.deviceString = state.deviceString;
    ig.state.deviceId = state.deviceId;
    ig.state.uuid = state.uuid;
    ig.state.phoneId = state.phoneId;
    ig.state.adid = state.adid;
    ig.state.build = state.build;
    await ig.state.deserializeCookieJar(cookies);
    fbns.auth.read(fbnsAuth);
}

/* Normal login to Instagram */
async function loginToInstagram(ig, fbns) {
    ig.request.end$.subscribe(() => saveState(ig, fbns));
    await ig.account.login(username, password);
}