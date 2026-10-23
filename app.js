/* Agent AI 铸造页：地址填写 → 链上资格检查 → 生成可粘贴给 AI 代理的指令（支持中英切换） */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const RPCS = [
    "https://bsc-dataseed1.binance.org",
    "https://bsc-dataseed.binance.org",
    "https://bsc.publicnode.com",
    "https://binance.llamarpc.com",
  ];
  const CHAIN_ID = 56;
  const MINT_SIG = "0x1249c58b"; // mint()

  /* ---------------- 多语言 ---------------- */

  const I18N = {
    zh: {
      "brand.sub": "Agent ID 专属铸造 · BSC",
      "btn.connect": "连接钱包",
      "hero.title": "持有币安 <em>Agent ID</em> 才能铸造",
      "hero.sub": "每次 <b>{price}</b> USDT 换 <b>{perMint}</b> 枚 {symbol}，单地址上限 <b>{limit}</b> 次。<br />下面填地址 → 自动检查资格 → 复制指令发给你的 AI 代理即可。",
      "card.mint": "铸造区",
      "label.addr": "钱包地址 / .ai 名称",
      "ph.addr": "0x… 或 yourname.ai",
      "hint.addr": "填 .ai 名称时请同时确认它对应的 0x 地址，链上检查需要地址",
      "label.tokenId": "Agent ID 编号（选填）",
      "ph.tokenId": "例如 1234",
      "label.count": "铸造次数",
      "hint.count": "实际可 mint 次数受合约单地址上限约束，点「检查资格」看剩余额度",
      "adv.summary": "高级：合约 / 代币参数",
      "label.contract": "合约地址", "label.usdt": "USDT 合约", "label.nft": "Agent ID NFT",
      "btn.check": "检查资格", "btn.gen": "生成 AI 指令",
      "card.cmd": "AI 指令", "btn.copy": "复制",
      "ph.cmd": "填好地址后点「生成 AI 指令」，这里会出现可直接粘贴给 AI 代理的完整指令",
      "hint.cmd": "把这段指令粘到 Agentic Wallet 的 AI 对话里，它会逐步 preview 并等你确认。",
      "card.steps": "让 AI 代理帮你铸造",
      "s1.h": "开启开发者模式", "s1.p1": "在币安 App 中，为你的 Agentic Wallet 开启开发者模式。",
      "s1.p2": "Agentic Wallet → 设置 → 开发者模式",
      "s2.h": "检查资格", "s2.p1": "在上方铸造区输入你的 .ai 名称。这个地址需要有：",
      "s2.l1": "Agent ID", "s2.l2": "每次", "s2.l2b": "USDT", "s2.l3": "少量 BNB 付手续费",
      "s3.h": "发给你的 AI 代理", "s3.p1": "把指令粘贴到 Agentic Wallet 的 AI 对话里。每一步它都会先预览，等你确认后再执行。",
      "card.apply": "如何申请 Agent ID",
      "invite.label": "专属邀请链接", "invite.go": "去注册", "invite.copy": "复制链接",
      "a1.h": "打开邀请链接", "a1.p": "用币安 App 扫码，或在币安 Web3 钱包内置浏览器打开，进入 Agent ID 页面。",
      "a2.h": "连接 / 创建 Agentic Wallet", "a2.p": "钱包里预留一点 BNB 付网络手续费。",
      "a3.h": "选 .ai 名称并提交", "a3.p": "按页面提示完成注册；是否仍需邀请名额，以官方页面显示为准。",
      "a4.h": "回来检查资格", "a4.p": "Agent ID 到账后，在上方铸造区填地址点「检查资格」，显示持有 ≥ 1 即可铸造。",
      "apply.note": "注册流程与名额以币安官方页面为准，可能随时调整。",
      "card.social": "社区与推广入口",
      "p1.b": "Agent ID 邀请", "p1.s": "注册领取 Agent ID",
      "p2.b": "Telegram", "p2.s": "电报社群",
      "p3.b": "X / Twitter", "p3.s": "官方推特",
      "p4.b": "Debox", "p4.s": "Debox 社群",
      "social.note": "搜索「请替换」即可找到待填链接；把 Telegram / X / Debox 三个换成你自己的地址。",
      "card.warn": "注意",
      "w1": "开盘前铸造到的 AGT <b>不可转账</b>，需等开盘后才能交易。",
      "w2": "每笔交易 AI 都会先 preview，请逐笔看清解析结果与风险再确认。",
      "w3": "本页只做地址填写与指令生成，不托管私钥、不代发交易。",
      "footer": "Agent AI · AGT — 本页不托管资产，请自行核对合约地址",

      "el.addr": "地址",
      "el.nft": "Agent ID 持有 {n} 个", "el.nftBad": "需要持有才能 mint",
      "el.usdt": "USDT 余额 {v}", "el.usdtNeed": "需 {v} USDT",
      "el.bnb": "BNB {v}", "el.bnbNeed": "需少量付 gas",
      "el.launched": "已开盘，不能再 mint", "el.notLaunched": "未开盘，可 mint",
      "el.progress": "已 mint {a}/{b}",
      "el.quota": "本地址剩余额度 {n} 次", "el.quotaSub": "上限 {m} 次，已用 {u}",
      "el.deadlineOk": "mint 未截止", "el.deadlineBad": "mint 已截止",
      "el.allow": "已授权 {v} USDT", "el.allowSkip": "第 1 笔可跳过", "el.allowNeed": "需要先授权",
      "el.loading": "正在读取链上数据…", "el.fail": "读取失败",

      "t.badAddr": "请填写正确的 0x 钱包地址（.ai 名称需先换成地址）",
      "t.needAddr": "请先填写正确的钱包地址",
      "t.checkDone": "资格检查完成",
      "t.readFail": "链上读取失败：",
      "t.genOk": "指令已生成，点右上角复制",
      "t.copyOk": "已复制到剪贴板",
      "t.copyFail": "请按 Ctrl+C 复制",
      "t.copyLink": "链接已复制",
      "t.copyLinkFail": "复制失败，请手动复制",
      "t.walletOk": "钱包已连接",
      "t.noWallet": "未检测到钱包插件",
      "t.connectFail": "连接失败",
      "t.genFirst": "请先生成指令",

      "cmd.body": `我有币安 Agentic Wallet，请在 BSC（binanceChainId {chain}）上帮我铸造 Agent AI（AGT）。
我的钱包地址：{addr}{idLine}

规则：
- 先运行 \`baw wallet settings --json\`，确认 devMode.enabled 为 true。
- 每笔交易都按「preview → 把解析结果和风险给我看 → 等我确认 → \`baw contract-call execute --requestId <这次 preview 返回的 requestId> --json\`」执行。
- 上一笔在链上确认成功后，再开始下一笔。
- 任何一步 preview 报错或被拦截，就停下告诉我，不要改参数重试。

第 1 笔：给 AGT 合约授权 {amountText} USDT（授权额度已够可跳过）
  合约: {uAddr}
  调用数据: {approveData}
  baw contract-call preview --binanceChainId {chain} --from {addr} --to {uAddr} --inputData {approveData} --json

{tail}：调用 AGT 合约的 mint()，共 {count} 笔，每笔单独 preview + execute，每笔 {priceText} USDT 换 {perMint} AGT
  合约: {cAddr}
  调用数据: {mintSig}
  baw contract-call preview --binanceChainId {chain} --from {addr} --to {cAddr} --inputData {mintSig} --json`,
    },

    en: {
      "brand.sub": "Agent ID exclusive mint · BSC",
      "btn.connect": "Connect wallet",
      "hero.title": "Only Binance <em>Agent ID</em> holders can mint",
      "hero.sub": "Each mint costs <b>{price}</b> USDT for <b>{perMint}</b> {symbol}, max <b>{limit}</b> per wallet.<br />Enter your address → auto-check eligibility → copy the command to your AI agent.",
      "card.mint": "Mint",
      "label.addr": "Wallet address / .ai name",
      "ph.addr": "0x… or yourname.ai",
      "hint.addr": "For a .ai name, also confirm the matching 0x address — the on-chain check needs it",
      "label.tokenId": "Agent ID number (optional)",
      "ph.tokenId": "e.g. 1234",
      "label.count": "Mint count",
      "hint.count": "The actual limit is set by the contract's per-wallet cap — click Check to see your remaining quota",
      "adv.summary": "Advanced: contract / token params",
      "label.contract": "Contract", "label.usdt": "USDT contract", "label.nft": "Agent ID NFT",
      "btn.check": "Check eligibility", "btn.gen": "Generate command",
      "card.cmd": "AI command", "btn.copy": "Copy",
      "ph.cmd": "Fill in your address and click Generate — the full command for your AI agent appears here",
      "hint.cmd": "Paste it into your Agentic Wallet AI chat. It previews every step and waits for your confirmation.",
      "card.steps": "Let Your AI Agent Mint For You",
      "s1.h": "Enable Developer Mode", "s1.p1": "In the Binance App, enable Developer Mode for your Agentic Wallet.",
      "s1.p2": "Agentic Wallet → Settings → Developer Mode",
      "s2.h": "Check eligibility", "s2.p1": "Enter your .ai name in the mint box above. This address needs:",
      "s2.l1": "Agent ID", "s2.l2": "per mint", "s2.l2b": "USDT", "s2.l3": "A little BNB for gas",
      "s3.h": "Send it to your AI agent", "s3.p1": "Paste the command into your Agentic Wallet AI chat. It previews each step and waits for your confirmation.",
      "card.apply": "How to Apply for Agent ID",
      "invite.label": "Exclusive invite link", "invite.go": "Register", "invite.copy": "Copy link",
      "a1.h": "Open the invite link", "a1.p": "Scan with the Binance App or open it in the Binance Web3 wallet browser to reach the Agent ID page.",
      "a2.h": "Connect / create Agentic Wallet", "a2.p": "Keep a little BNB in the wallet for gas.",
      "a3.h": "Pick your .ai name and submit", "a3.p": "Follow the page instructions; whether an invite slot is still required follows the official page.",
      "a4.h": "Come back and check", "a4.p": "Once your Agent ID arrives, enter the address above and click Check — holding ≥ 1 means you can mint.",
      "apply.note": "The registration flow and availability follow Binance's official page and may change at any time.",
      "card.social": "Community & Links",
      "p1.b": "Agent ID invite", "p1.s": "Register and claim your Agent ID",
      "p2.b": "Telegram", "p2.s": "Telegram group",
      "p3.b": "X / Twitter", "p3.s": "Official X account",
      "p4.b": "Debox", "p4.s": "Debox community",
      "social.note": "Search the file for the placeholder links and replace Telegram / X / Debox with your own.",
      "card.warn": "Notes",
      "w1": "AGT minted before launch <b>cannot be transferred</b> until trading opens.",
      "w2": "Your AI previews every transaction — read each parsed result and risk note before confirming.",
      "w3": "This page only builds the command. It never holds your keys or sends transactions for you.",
      "footer": "Agent AI · AGT — this page does not custody assets; always verify the contract address",

      "el.addr": "Address",
      "el.nft": "Agent ID held: {n}", "el.nftBad": "You must hold one to mint",
      "el.usdt": "USDT balance {v}", "el.usdtNeed": "need {v} USDT",
      "el.bnb": "BNB {v}", "el.bnbNeed": "keep some for gas",
      "el.launched": "Already launched — mint closed", "el.notLaunched": "Not launched — mint open",
      "el.progress": "minted {a}/{b}",
      "el.quota": "Remaining quota: {n}", "el.quotaSub": "limit {m}, used {u}",
      "el.deadlineOk": "Mint window open", "el.deadlineBad": "Mint window closed",
      "el.allow": "Allowance {v} USDT", "el.allowSkip": "step 1 can be skipped", "el.allowNeed": "approve first",
      "el.loading": "Reading on-chain data…", "el.fail": "Read failed",

      "t.badAddr": "Enter a valid 0x address (.ai names must be resolved to an address first)",
      "t.needAddr": "Enter a valid wallet address first",
      "t.checkDone": "Eligibility check done",
      "t.readFail": "On-chain read failed: ",
      "t.genOk": "Command generated — click Copy",
      "t.copyOk": "Copied to clipboard",
      "t.copyFail": "Press Ctrl+C to copy",
      "t.copyLink": "Link copied",
      "t.copyLinkFail": "Copy failed, please copy manually",
      "t.walletOk": "Wallet connected",
      "t.noWallet": "No wallet extension detected",
      "t.connectFail": "Connection failed",
      "t.genFirst": "Generate the command first",

      "cmd.body": `I have a Binance Agentic Wallet. Please mint Agent AI (AGT) for me on BSC (binanceChainId {chain}).
My wallet address: {addr}{idLine}

Rules:
- First run \`baw wallet settings --json\` and confirm devMode.enabled is true.
- For every transaction: preview → show me the parsed result and risks → wait for my confirmation → \`baw contract-call execute --requestId <requestId from that preview> --json\`.
- Only start the next transaction after the previous one is confirmed on chain.
- If any preview errors out or gets blocked, stop and tell me. Do not retry with changed parameters.

Tx 1: approve {amountText} USDT to the AGT contract (skip if allowance is already enough)
  Contract: {uAddr}
  Input data: {approveData}
  baw contract-call preview --binanceChainId {chain} --from {addr} --to {uAddr} --inputData {approveData} --json

{tail}: call mint() on the AGT contract, {count} tx total, each with its own preview + execute, {priceText} USDT for {perMint} AGT per mint
  Contract: {cAddr}
  Input data: {mintSig}
  baw contract-call preview --binanceChainId {chain} --from {addr} --to {cAddr} --inputData {mintSig} --json`,
    },
  };

  let LANG = localStorage.getItem("agt_lang") === "en" ? "en" : "zh";

  function t(key, vars) {
    let s = (I18N[LANG] && I18N[LANG][key]) || (I18N.zh[key] && I18N.zh[key]) || key;
    if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }

  let heroVals = { price: "0.01", perMint: "21,000", symbol: "AGT", limit: "3" };

  // 铸造次数 1~10
  function buildCountOptions() {
    const sel = $("count");
    const keep = sel.value || "1";
    sel.innerHTML = "";
    for (let i = 1; i <= 10; i++) {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = LANG === "zh" ? `${i} 次` : `${i} time${i > 1 ? "s" : ""}`;
      sel.appendChild(o);
    }
    sel.value = keep;
  }

  function paintHero() {
    document.querySelectorAll("[data-i18n-html='hero.sub']").forEach((el) => (el.innerHTML = t("hero.sub", heroVals)));
    document.querySelectorAll(".step .price").forEach((el) => (el.textContent = heroVals.price));
  }

  function applyLang(lang) {
    LANG = lang;
    localStorage.setItem("agt_lang", lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
    $("langBtn").textContent = lang === "zh" ? "EN" : "中";
    if (account) $("connectBtn").textContent = shortAddr(account);
    buildCountOptions();
    paintHero();
    renderRows();
    if ($("cmd").value && addr()) $("cmd").value = buildCommand() || $("cmd").value;
  }

  let provider = null;
  let info = null;
  let account = null;
  let lastCheck = null;

  function shortAddr(a) {
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  function toast(msg, type) {
    const el = $("toast");
    el.textContent = msg;
    el.className = "show " + (type || "");
    clearTimeout(el._t);
    el._t = setTimeout(() => ((el.className = type || ""), 3600));
  }

  async function getProvider() {
    if (provider) return provider;
    for (const url of RPCS) {
      try {
        const p = new ethers.JsonRpcProvider(url);
        await p.getBlockNumber();
        provider = p;
        return p;
      } catch {}
    }
    throw new Error("all public RPCs unavailable");
  }

  function addr() {
    const v = $("addr").value.trim();
    if (!v) return null;
    if (ethers.isAddress(v)) return ethers.getAddress(v);
    return null; // .ai 名称无法在链上解析
  }

  /* ---------- 载入合约参数（无需地址） ---------- */

  async function loadInfo() {
    const p = await getProvider();
    const c = new ethers.Contract(
      $("contract").value.trim(),
      [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function PRICE() view returns (uint256)",
        "function PER_MINT() view returns (uint256)",
        "function MAX_PER_WALLET() view returns (uint256)",
        "function MAX_MINTS() view returns (uint256)",
        "function mintCount() view returns (uint256)",
        "function mintDeadline() view returns (uint256)",
        "function launched() view returns (bool)",
        "function USDT() view returns (address)",
        "function AGENT_ID() view returns (address)",
        "function mintedBy(address) view returns (uint256)",
      ],
      p
    );
    const u = new ethers.Contract(
      await c.USDT(),
      ["function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"],
      p
    );

    const [name, symbol, price, perMint, maxPerWallet, maxMints, mintCount, deadline, launched, usdtDec, nft] =
      await Promise.all([
        c.name(), c.symbol(), c.PRICE(), c.PER_MINT(), c.MAX_PER_WALLET(), c.MAX_MINTS(),
        c.mintCount(), c.mintDeadline(), c.launched(), u.decimals(), c.AGENT_ID(),
      ]);

    info = { c, u, contract: await c.getAddress(), name, symbol, price, perMint, maxPerWallet, maxMints, mintCount, deadline, launched, usdtDec, nft };

    heroVals = {
      price: ethers.formatUnits(price, usdtDec),
      perMint: Number(ethers.formatUnits(perMint, 18)).toLocaleString("en-US"),
      symbol,
      limit: String(maxPerWallet),
    };
    paintHero();
    $("usdt").value = await info.u.getAddress();
    $("nft").value = nft;
    return info;
  }

  /* ---------- 资格检查 ---------- */

  function row(ok, label, extra) {
    return `<div class="row ${ok ? "ok" : "bad"}"><i>${ok ? "✓" : "✗"}</i><b>${label}</b><span>${extra || ""}</span></div>`;
  }

  function renderRows() {
    if (!lastCheck) return;
    const d = lastCheck;
    const rows = [
      row(true, t("el.addr"), d.a),
      row(Number(d.nftBal) > 0, t("el.nft", { n: String(d.nftBal) }), Number(d.nftBal) > 0 ? "" : t("el.nftBad")),
      row(d.usdtBal >= d.need, t("el.usdt", { v: d.fmtU(d.usdtBal) }), t("el.usdtNeed", { v: d.fmtU(d.need) })),
      row(d.bnb > 0n, t("el.bnb", { v: Number(ethers.formatEther(d.bnb)).toFixed(5) }), t("el.bnbNeed")),
      row(!d.launched, d.launched ? t("el.launched") : t("el.notLaunched"), t("el.progress", { a: String(d.mintCount), b: String(d.maxMints) })),
      row(d.left >= d.count, t("el.quota", { n: String(d.left) }), t("el.quotaSub", { m: String(d.maxPerWallet), u: String(d.minted) })),
      row(d.deadline > d.now, d.deadline > d.now ? t("el.deadlineOk") : t("el.deadlineBad"), new Date(d.deadline * 1000).toLocaleString()),
      row(d.allowance >= d.need, t("el.allow", { v: d.fmtU(d.allowance) }), d.allowance >= d.need ? t("el.allowSkip") : t("el.allowNeed")),
    ];
    $("elig").innerHTML = rows.join("");
    $("elig").classList.add("show");
  }

  async function check() {
    const a = addr();
    if (!a) return toast(t("t.badAddr"), "err");
    $("elig").classList.add("show");
    $("elig").innerHTML = row(false, t("el.loading"), "");
    try {
      const i = info || (await loadInfo());
      const count = Number($("count").value);
      const need = i.price * BigInt(count);
      const nft = new ethers.Contract(i.nft, ["function balanceOf(address) view returns (uint256)"], provider);

      const [nftBal, usdtBal, bnb, minted, allowance] = await Promise.all([
        nft.balanceOf(a), i.u.balanceOf(a), provider.getBalance(a), i.c.mintedBy(a), i.u.allowance(a, i.contract),
      ]);

      const fmtU = (v) => Number(ethers.formatUnits(v, Number(i.usdtDec))).toLocaleString("en-US", { maximumFractionDigits: 6 });
      lastCheck = {
        a, count, need, nftBal, usdtBal, bnb, minted, allowance, fmtU,
        launched: i.launched, mintCount: i.mintCount, maxMints: i.maxMints, maxPerWallet: i.maxPerWallet,
        left: Number(i.maxPerWallet) - Number(minted), deadline: Number(i.deadline), now: Math.floor(Date.now() / 1000),
      };
      renderRows();
      toast(t("t.checkDone"), "ok");
    } catch (e) {
      $("elig").innerHTML = row(false, t("el.fail"), e.shortMessage || e.message);
      toast(t("t.readFail") + (e.shortMessage || e.message), "err");
    }
  }

  /* ---------- 生成 AI 指令 ---------- */

  function buildCommand() {
    const a = addr();
    if (!a) {
      toast(t("t.needAddr"), "err");
      return null;
    }
    const count = Number($("count").value);
    const cAddr = ethers.getAddress($("contract").value.trim());
    const uAddr = ethers.getAddress($("usdt").value.trim());
    const dec = info ? Number(info.usdtDec) : 18;
    const price = info ? BigInt(info.price) : ethers.parseUnits("0.01", dec);
    const perMint = info ? Number(ethers.formatUnits(info.perMint, 18)).toLocaleString("en-US") : "21,000";
    const amount = price * BigInt(count);
    const amountText = Number(ethers.formatUnits(amount, dec)).toLocaleString("en-US", { maximumFractionDigits: 6 });
    const priceText = Number(ethers.formatUnits(price, dec)).toLocaleString("en-US", { maximumFractionDigits: 6 });

    const enc = ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [cAddr, amount]);
    const approveData = "0x095ea7b3" + enc.slice(2);

    const tid = $("tokenId").value.trim();
    const idLine = tid ? `\n${LANG === "zh" ? "我的 Agent ID 编号" : "My Agent ID number"}: #${tid}` : "";
    const tail = count > 1 ? (LANG === "zh" ? `第 2～${count + 1} 笔` : `Tx 2-${count + 1}`) : LANG === "zh" ? "第 2 笔" : "Tx 2";

    return t("cmd.body", {
      chain: String(CHAIN_ID), addr: a, idLine, amountText, uAddr, approveData,
      cAddr, mintSig: MINT_SIG, tail, count: String(count), priceText, perMint,
    });
  }

  async function generate() {
    try {
      await loadInfo();
    } catch {}
    const cmd = buildCommand();
    if (!cmd) return;
    $("cmd").value = cmd;
    toast(t("t.genOk"), "ok");
  }

  /* ---------- 钱包 ---------- */

  async function connect() {
    if (!window.ethereum) return toast(t("t.noWallet"), "err");
    try {
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      account = accs[0];
      $("addr").value = account;
      $("connectBtn").textContent = shortAddr(account);
      toast(t("t.walletOk"), "ok");
    } catch (e) {
      toast(e.message || t("t.connectFail"), "err");
    }
  }

  async function copyCmd() {
    const v = $("cmd").value;
    if (!v) return toast(t("t.genFirst"), "err");
    try {
      await navigator.clipboard.writeText(v);
      toast(t("t.copyOk"), "ok");
    } catch {
      $("cmd").select();
      toast(t("t.copyFail"), "err");
    }
  }

  /* ---------- 绑定 ---------- */

  $("langBtn").addEventListener("click", () => applyLang(LANG === "zh" ? "en" : "zh"));

  // 通用复制（邀请链接等）
  document.querySelectorAll("[data-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        toast(t("t.copyLink"), "ok");
      } catch {
        toast(t("t.copyLinkFail"), "err");
      }
    })
  );

  $("connectBtn").addEventListener("click", connect);
  $("checkBtn").addEventListener("click", check);
  $("genBtn").addEventListener("click", generate);
  $("copyBtn").addEventListener("click", copyCmd);

  applyLang(LANG);
  loadInfo().catch(() => {});
})();
