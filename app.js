/* Agent AI 铸造页：地址填写 → 链上资格检查 → 生成可粘贴给 AI 代理的指令 */
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

  let provider = null;
  let info = null; // 合约参数缓存
  let account = null;

  function toast(msg, type) {
    const el = $("toast");
    el.textContent = msg;
    el.className = "show " + (type || "");
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.className = type || "", 3600));
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
    throw new Error("所有公共节点都不可用");
  }

  function addr() {
    const v = $("addr").value.trim();
    if (!v) return null;
    if (ethers.isAddress(v)) return ethers.getAddress(v);
    if (v.toLowerCase().endsWith(".ai")) return null; // .ai 名称无法在链上解析
    return null;
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
    const u = new ethers.Contract(await c.USDT(), ["function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"], p);

    const [name, symbol, price, perMint, maxPerWallet, maxMints, mintCount, deadline, launched, usdtDec, nft] =
      await Promise.all([
        c.name(), c.symbol(), c.PRICE(), c.PER_MINT(), c.MAX_PER_WALLET(), c.MAX_MINTS(),
        c.mintCount(), c.mintDeadline(), c.launched(), u.decimals(), c.AGENT_ID(),
      ]);

    info = { c, u, contract: await c.getAddress(), name, symbol, price, perMint, maxPerWallet, maxMints, mintCount, deadline, launched, usdtDec, nft };

    const priceU = ethers.formatUnits(price, usdtDec);
    $("h_price").textContent = priceU;
    $("h_perMint").textContent = Number(ethers.formatUnits(perMint, 18)).toLocaleString("en-US");
    $("h_limit").textContent = String(maxPerWallet);
    document.querySelectorAll(".step .price").forEach((el) => (el.textContent = priceU));
    $("usdt").value = await info.u.getAddress();
    $("nft").value = nft;
    return info;
  }

  /* ---------- 资格检查 ---------- */

  function row(ok, label, extra) {
    return `<div class="row ${ok ? "ok" : "bad"}"><i>${ok ? "✓" : "✗"}</i><b>${label}</b><span>${extra || ""}</span></div>`;
  }

  async function check() {
    const a = addr();
    if (!a) {
      toast("请填写正确的 0x 钱包地址（.ai 名称需先换成地址）", "err");
      return;
    }
    $("elig").classList.add("show");
    $("elig").innerHTML = row(false, "正在读取链上数据…", "");
    try {
      const i = info || (await loadInfo());
      const count = Number($("count").value);
      const need = i.price * BigInt(count);
      const nft = new ethers.Contract(i.nft, ["function balanceOf(address) view returns (uint256)"], provider);

      const [nftBal, usdtBal, bnb, minted, allowance] = await Promise.all([
        nft.balanceOf(a),
        i.u.balanceOf(a),
        provider.getBalance(a),
        i.c.mintedBy(a),
        i.u.allowance(a, i.contract),
      ]);

      const uDec = Number(i.usdtDec);
      const now = Math.floor(Date.now() / 1000);
      const left = Number(i.maxPerWallet) - Number(minted);
      const fmtU = (v) => Number(ethers.formatUnits(v, uDec)).toLocaleString("en-US", { maximumFractionDigits: 6 });

      const rows = [
        row(true, "地址", a),
        row(Number(nftBal) > 0, `Agent ID 持有 ${String(nftBal)} 个`, Number(nftBal) > 0 ? "" : "需要持有才能 mint"),
        row(usdtBal >= need, `USDT 余额 ${fmtU(usdtBal)}`, `需 ${fmtU(need)} USDT`),
        row(bnb > 0n, `BNB ${Number(ethers.formatEther(bnb)).toFixed(5)}`, "需少量付 gas"),
        row(!i.launched, i.launched ? "已开盘，不能再 mint" : "未开盘，可 mint", `已 mint ${i.mintCount}/${i.maxMints}`),
        row(left >= count, `本地址剩余额度 ${left} 次`, `上限 ${i.maxPerWallet} 次，已用 ${minted}`),
        row(Number(i.deadline) > now, Number(i.deadline) > now ? "mint 未截止" : "mint 已截止", new Date(Number(i.deadline) * 1000).toLocaleString()),
        row(allowance >= need, `已授权 ${fmtU(allowance)} USDT`, allowance >= need ? "第 1 笔可跳过" : "需要先授权"),
      ];
      $("elig").innerHTML = rows.join("");
      toast("资格检查完成", "ok");
    } catch (e) {
      $("elig").innerHTML = row(false, "读取失败", e.shortMessage || e.message);
      toast("链上读取失败：" + (e.shortMessage || e.message), "err");
    }
  }

  /* ---------- 生成 AI 指令 ---------- */

  function buildCommand() {
    const a = addr();
    if (!a) {
      toast("请先填写正确的钱包地址", "err");
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
    const idLine = tid ? `\n我的 Agent ID 编号：#${tid}` : "";
    const tail = count > 1 ? `第 2～${count + 1} 笔` : "第 2 笔";

    return `我有币安 Agentic Wallet，请在 BSC（binanceChainId ${CHAIN_ID}）上帮我铸造 Agent AI（AGT）。
我的钱包地址：${a}${idLine}

规则：
- 先运行 \`baw wallet settings --json\`，确认 devMode.enabled 为 true。
- 每笔交易都按「preview → 把解析结果和风险给我看 → 等我确认 → \`baw contract-call execute --requestId <这次 preview 返回的 requestId> --json\`」执行。
- 上一笔在链上确认成功后，再开始下一笔。
- 任何一步 preview 报错或被拦截，就停下告诉我，不要改参数重试。

第 1 笔：给 AGT 合约授权 ${amountText} USDT（授权额度已够可跳过）
  合约: ${uAddr}
  调用数据: ${approveData}
  baw contract-call preview --binanceChainId ${CHAIN_ID} --from ${a} --to ${uAddr} --inputData ${approveData} --json

${tail}：调用 AGT 合约的 mint()，共 ${count} 笔，每笔单独 preview + execute，每笔 ${priceText} USDT 换 ${perMint} AGT
  合约: ${cAddr}
  调用数据: ${MINT_SIG}
  baw contract-call preview --binanceChainId ${CHAIN_ID} --from ${a} --to ${cAddr} --inputData ${MINT_SIG} --json`;
  }

  async function generate() {
    try {
      await loadInfo();
    } catch {
      /* 读不到链上数据时用默认参数继续生成 */
    }
    const cmd = buildCommand();
    if (!cmd) return;
    $("cmd").value = cmd;
    toast("指令已生成，点右上角复制", "ok");
  }

  /* ---------- 钱包 ---------- */

  async function connect() {
    if (!window.ethereum) return toast("未检测到钱包插件", "err");
    try {
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      account = accs[0];
      $("addr").value = account;
      $("connectBtn").textContent = account.slice(0, 6) + "..." + account.slice(-4);
      toast("钱包已连接", "ok");
    } catch (e) {
      toast(e.message || "连接失败", "err");
    }
  }

  async function copyCmd() {
    const v = $("cmd").value;
    if (!v) return toast("请先生成指令", "err");
    try {
      await navigator.clipboard.writeText(v);
      toast("已复制到剪贴板", "ok");
    } catch {
      $("cmd").select();
      toast("请按 Ctrl+C 复制", "err");
    }
  }

  /* ---------- 绑定 ---------- */

  $("connectBtn").addEventListener("click", connect);
  $("checkBtn").addEventListener("click", check);
  $("genBtn").addEventListener("click", generate);
  $("copyBtn").addEventListener("click", copyCmd);

  loadInfo().catch(() => {});
})();
