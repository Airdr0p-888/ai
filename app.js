/* 固定参数部署页：经济参数写死不可改，只填名称/符号/税收钱包 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const HISTORY_KEY = "agent_launch_history"; // 与部署面板共用，方便管理面板直接载入
  const CHAIN_ID = 56;
  const EXPLORER = "https://bscscan.com";
  const BSC = {
    chainId: "0x38",
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed1.binance.org"],
    blockExplorerUrls: [EXPLORER],
  };

  /* ---- 写死的参数（改这里要同步改合约校验） ---- */
  const FIXED = {
    agentId: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F", // 币安 Agent ID
    usdt: "0x55d398326f99059fF775485246999027B3197955",
    factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
    usdtDec: 18,
    price: 5, // USDT
    perMint: 5250, // 枚
    maxMints: 2000, // 份
    maxSupply: 21000000, // 枚（硬顶）
    maxPerWallet: 10,
    taxPct: 1,
    lpLockDays: 30,
    mintWindowDays: 30,
  };

  let provider, signer, account, chainId;

  function toast(msg, type) {
    const el = $("toast");
    el.textContent = msg;
    el.className = "show " + (type || "");
    clearTimeout(el._t);
    el._t = setTimeout(() => ((el.className = type || ""), 4200));
  }

  function shortAddr(a) {
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  function fmt(n) {
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 8 });
  }

  /* ---------------- 派生数值 ---------------- */

  function price() {
    const p = Number($("f_price").value);
    return Number.isFinite(p) && p > 0 ? p : FIXED.price;
  }

  function paintDerived() {
    const sym = $("f_symbol").value.trim() || "AGT";
    const p = price();
    const raise = p * FIXED.maxMints;
    const user = FIXED.perMint * FIXED.maxMints;
    $("d_raise").textContent = fmt(raise) + " USDT";
    $("d_user").textContent = fmt(user) + " " + sym;
    $("d_pool").textContent = fmt(user) + " " + sym;
    $("d_total").textContent = fmt(user * 2) + " " + sym + (user * 2 <= FIXED.maxSupply ? " ✓" : " ✗ 超过硬顶");
    $("d_price").textContent = (p / FIXED.perMint).toFixed(8) + " USDT / 枚";
    $("d_wallet").textContent = fmt(FIXED.perMint * FIXED.maxPerWallet) + " " + sym + "（" + fmt(p * FIXED.maxPerWallet) + " USDT）";
  }

  /* ---------------- 钱包 / 网络 ---------------- */

  async function ensureChain() {
    const cur = await window.ethereum.request({ method: "eth_chainId" });
    if (Number(cur) === CHAIN_ID) return;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC.chainId }] });
    } catch (e) {
      if (e && (e.code === 4902 || /Unrecognized chain/i.test(e.message || ""))) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [BSC] });
      } else {
        throw e;
      }
    }
  }

  async function connect() {
    if (!window.ethereum) return toast("请先安装 MetaMask / OKX 等钱包插件", "err");
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      await ensureChain();
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      account = accs[0];
      signer = await provider.getSigner();
      chainId = Number((await provider.getNetwork()).chainId);
      $("connectBtn").textContent = shortAddr(account);
      const ok = chainId === CHAIN_ID;
      $("netHint").textContent = ok
        ? "已连接 BSC 主网（56），可以直接部署。"
        : "当前不在 BSC 主网，请切换后再部署。";
      $("netHint").className = ok ? "hint" : "hint danger";
      $("deployBtn").disabled = !ok;
    } catch (e) {
      toast(e.shortMessage || e.message || "连接失败", "err");
    }
  }

  /* ---------------- 部署 ---------------- */

  // 硬顶自检（其余参数写死在合约里，只有名称 / 符号 / 价格可改）
  function selfCheck() {
    return FIXED.maxSupply >= FIXED.perMint * FIXED.maxMints * 2;
  }

  async function deploy() {
    if (!account) return toast("请先连接钱包", "err");
    if (chainId !== CHAIN_ID) return toast("请切换到 BSC 主网（56）", "err");

    const name = $("f_name").value.trim();
    const symbol = $("f_symbol").value.trim();
    if (!name || !symbol) return toast("请填写代币名称与符号", "err");
    const p = price();
    if (!(p > 0)) return toast("每份价格必须大于 0", "err");

    // 部署前本地再校验一次硬顶，避免白烧 gas
    if (!selfCheck()) return toast("硬顶装不下当前参数", "err");

    const btn = $("deployBtn");
    btn.disabled = true;
    btn.textContent = "部署中…";
    try {
      const args = [name, symbol, ethers.parseUnits(String(p), FIXED.usdtDec)];
      const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(["string", "string", "uint256"], args);
      const factory = new ethers.ContractFactory(window.ARTIFACT_FIXED.abi, window.ARTIFACT_FIXED.bytecode, signer);
      const c = await factory.deploy(...args);
      toast("交易已提交，等待确认…");
      const rc = await c.deploymentTransaction().wait();
      const addr = await c.getAddress();

      $("result").classList.remove("hidden");
      $("r_addr").innerHTML = `<a href="${EXPLORER}/address/${addr}" target="_blank">${addr}</a>`;
      $("r_tx").innerHTML = `<a href="${EXPLORER}/tx/${rc.hash}" target="_blank">${shortAddr(rc.hash)}</a>`;
      $("r_args").value = encodedArgs;
      $("r_verify").href = `${EXPLORER}/verifyContract?a=${addr}`;

      try {
        const list = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
        list.unshift({ address: addr, name, symbol, chainId: CHAIN_ID });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
      } catch {}

      toast("部署成功", "ok");
    } catch (e) {
      const m = e.shortMessage || e.reason || e.message || "";
      toast("部署失败：" + m, "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "部署合约";
    }
  }

  /* ---------------- 绑定 ---------------- */

  async function copyArgs() {
    const v = $("r_args").value;
    if (!v) return toast("还没有部署记录", "err");
    try {
      await navigator.clipboard.writeText(v);
      toast("构造参数已复制", "ok");
    } catch {
      $("r_args").select();
      toast("请按 Ctrl+C 复制", "err");
    }
  }

  $("connectBtn").addEventListener("click", connect);
  $("deployBtn").addEventListener("click", deploy);
  $("copyArgsBtn").addEventListener("click", copyArgs);
  ["f_name", "f_symbol", "f_price"].forEach((id) => $(id).addEventListener("input", paintDerived));

  window.ethereum && window.ethereum.on && window.ethereum.on("chainChanged", () => location.reload());

  paintDerived();
  if (!window.ARTIFACT_FIXED) toast("未加载到编译产物，请先执行 npm run compile:fixed", "err");
  if (window.ethereum) {
    window.ethereum.request({ method: "eth_accounts" }).then((accs) => accs && accs[0] && connect());
  }
})();
