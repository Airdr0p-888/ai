/* AgentToken 发射台 —— 部署 + 管理面板 */
(function () {
  "use strict";

  const CHAINS = {
    56: {
      name: "BSC 主网",
      explorer: "https://bscscan.com",
      add: {
        chainId: "0x38",
        chainName: "BNB Smart Chain",
        nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
        rpcUrls: ["https://bsc-dataseed.binance.org"],
        blockExplorerUrls: ["https://bscscan.com"],
      },
    },
    97: {
      name: "BSC 测试网",
      explorer: "https://testnet.bscscan.com",
      add: {
        chainId: "0x61",
        chainName: "BNB Smart Chain Testnet",
        nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
        rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
        blockExplorerUrls: ["https://testnet.bscscan.com"],
      },
    },
  };

  const $ = (id) => document.getElementById(id);
  const HISTORY_KEY = "agent_launch_history";

  let provider, signer, account, chainId = 56;
  let contract, usdt, state = {};

  /* ---------------- 工具 ---------------- */

  function toast(msg, type) {
    const el = $("toast");
    el.textContent = msg;
    el.className = "toast show " + (type || "");
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.className = "toast " + (type || "")), 4200);
  }

  function shortAddr(a) {
    return a ? a.slice(0, 6) + "..." + a.slice(-4) : "-";
  }

  function fmtNum(n) {
    const x = Number(n);
    if (!isFinite(x)) return "-";
    if (x === 0) return "0";
    if (Math.abs(x) < 0.000001) return x.toExponential(2);
    return x.toLocaleString("en-US", { maximumFractionDigits: 6 });
  }

  function link(addr, text) {
    const base = CHAINS[chainId].explorer;
    return `<a href="${base}/address/${addr}" target="_blank">${text || shortAddr(addr)}</a>`;
  }

  function txLink(hash, text) {
    return `<a href="${CHAINS[chainId].explorer}/tx/${hash}" target="_blank">${text || shortAddr(hash)}</a>`;
  }

  function countdown(target) {
    const d = Number(target) - Math.floor(Date.now() / 1000);
    if (d <= 0) return "已到期";
    const day = Math.floor(d / 86400);
    const h = Math.floor((d % 86400) / 3600);
    const m = Math.floor((d % 3600) / 60);
    return day > 0 ? `${day} 天 ${h} 小时后` : `${h} 小时 ${m} 分后`;
  }

  function errText(e) {
    let msg = e && (e.shortMessage || e.reason || e.message) || String(e);
    if (/user rejected|ACTION_REJECTED|4001/i.test(msg)) return "用户取消了交易";
    const m = String(msg).match(/reverted with the following reason:\s*(.*)/i);
    if (m) return "合约拒绝：" + m[1];
    const c = String(msg).match(/custom error '(\w+)'/);
    if (c) return "合约拒绝：" + c[1];
    return String(msg).slice(0, 260);
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
  }

  function pushHistory(rec) {
    const list = getHistory().filter((r) => r.address !== rec.address);
    list.unshift(rec);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
    renderHistory();
  }

  function renderHistory() {
    const sel = $("m_history");
    const list = getHistory().filter((r) => r.chainId === chainId);
    sel.innerHTML = list.length
      ? list.map((r) => `<option value="${r.address}">${r.name} (${r.symbol}) · ${shortAddr(r.address)}</option>`).join("")
      : '<option value="">— 无 —</option>';
  }

  /* ---------------- 钱包 ---------------- */

  async function ensureChain() {
    const want = Number($("chainSelect").value);
    const cur = await window.ethereum.request({ method: "eth_chainId" });
    if (Number(cur) === want) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAINS[want].add.chainId }],
      });
    } catch (e) {
      if (e && (e.code === 4902 || /Unrecognized chain/i.test(e.message || ""))) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [CHAINS[want].add] });
      } else {
        throw e;
      }
    }
  }

  async function connect() {
    if (!window.ethereum) return toast("请先安装 MetaMask / OKX 等钱包插件", "err");
    try {
      await ensureChain();
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      account = accs[0];
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      const net = await provider.getNetwork();
      chainId = Number(net.chainId);
      $("connectBtn").textContent = shortAddr(account);
      $("netLabel").textContent = `${CHAINS[chainId] ? CHAINS[chainId].name : "Chain " + chainId} · ${shortAddr(account)}`;
      renderHistory();
      toast("钱包已连接", "ok");
    } catch (e) {
      toast(errText(e), "err");
    }
  }

  window.ethereum &&
    window.ethereum.on &&
    window.ethereum.on("chainChanged", () => location.reload());

  /* ---------------- 部署 ---------------- */

  function readForm() {
    const usdtDec = Number($("f_usdtDecimals").value);
    const price = Number($("f_price").value);
    const perMint = Number($("f_perMint").value);
    const maxMints = Number($("f_maxMints").value);
    return {
      name: $("f_name").value.trim(),
      symbol: $("f_symbol").value.trim(),
      agentId: $("f_agentId").value.trim(),
      usdt: $("f_usdt").value.trim(),
      factory: $("f_factory").value.trim(),
      taxWallet: $("f_taxWallet").value.trim() || account,
      usdtDec,
      price,
      perMint,
      maxMints,
      maxSupply: Number($("f_maxSupply").value),
      maxPerWallet: Number($("f_maxPerWallet").value),
      taxPct: Number($("f_taxPct").value),
      lpLockDays: Number($("f_lpLockDays").value),
      mintWindowDays: Number($("f_mintWindowDays").value),
    };
  }

  function renderPreview() {
    const f = readForm();
    const raise = f.maxMints * f.price;
    const supply = f.maxMints * f.perMint;
    const openPrice = f.perMint ? f.price / f.perMint : 0;
    $("preview").innerHTML = `
      <li><span>满额募资</span><b>${fmtNum(raise)} USDT</b></li>
      <li><span>用户侧发行</span><b>${fmtNum(supply)} ${f.symbol || ""}</b></li>
      <li><span>开盘进池（同量）</span><b>${fmtNum(supply)} ${f.symbol || ""}</b></li>
      <li><span>满额总供应</span><b class="${supply * 2 > f.maxSupply ? "danger" : ""}">${fmtNum(supply * 2)} ${f.symbol || ""}</b></li>
      <li><span>有效总量（硬顶）</span><b>${fmtNum(f.maxSupply)} ${f.symbol || ""}${supply * 2 > f.maxSupply ? " ⚠ 装不下，部署会失败" : ""}</b></li>
      <li><span>开盘价</span><b>${openPrice.toExponential(2)} USDT / 枚</b></li>
      <li><span>买卖税率</span><b>${f.taxPct}% → ${link(f.taxWallet || "0x", shortAddr(f.taxWallet))}</b></li>
      <li><span>LP 锁仓</span><b>${f.lpLockDays} 天</b></li>
      <li><span>NFT 门槛</span><b>${/^0x0{40}$/i.test(f.agentId) ? "关闭" : "开启"}</b></li>`;
  }

  async function deploy() {
    if (!account) return toast("请先连接钱包", "err");
    const f = readForm();
    if (!f.name || !f.symbol) return toast("请填写代币名称与符号", "err");
    for (const [k, v] of [["USDT", f.usdt], ["Factory", f.factory], ["税收钱包", f.taxWallet]]) {
      if (!ethers.isAddress(v)) return toast(k + " 地址不合法", "err");
    }
    if (!f.agentId || /^0x0{40}$/i.test(f.agentId)) f.agentId = ethers.ZeroAddress; // 留空 / 全零 = 不设门槛
    else if (!ethers.isAddress(f.agentId)) return toast("NFT 地址不合法", "err");
    if (!(f.price > 0 && f.perMint > 0 && f.maxMints > 0 && f.maxPerWallet > 0 && f.maxSupply > 0)) return toast("经济参数必须大于 0", "err");
    if (f.taxPct < 0 || f.taxPct > 10) return toast("税率需在 0 ~ 10% 之间", "err");
    if (f.maxSupply < f.maxMints * f.perMint * 2) return toast(`硬顶装不下：需要 ≥ ${f.maxMints * f.perMint * 2}，点「按硬顶自动分配每份」可自动算`, "err");

    const btn = $("deployBtn");
    btn.disabled = true;
    btn.textContent = "部署中…";
    try {
      const args = [
        f.name,
        f.symbol,
        f.agentId,
        f.usdt,
        f.factory,
        ethers.parseUnits(String(f.price), f.usdtDec),
        ethers.parseUnits(String(f.perMint), 18),
        f.maxMints,
        ethers.parseUnits(String(f.maxSupply), 18),
        f.maxPerWallet,
        Math.floor(f.lpLockDays * 86400),
        Math.round(f.taxPct * 100),
        Math.floor(f.mintWindowDays * 86400),
        f.taxWallet,
      ];
      const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "address", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "address"],
        args
      );
      const factory = new ethers.ContractFactory(ARTIFACT.abi, ARTIFACT.bytecode, signer);
      const c = await factory.deploy(...args);
      $("r_args").value = encodedArgs;
      toast("交易已提交，等待确认…");
      await c.waitForDeployment();
      const addr = await c.getAddress();
      const tx = c.deploymentTransaction();
      $("deployResult").classList.remove("hidden");
      $("r_addr").innerHTML = link(addr, addr);
      $("r_tx").innerHTML = txLink(tx.hash);
      $("r_verify").href = `${CHAINS[chainId].explorer}/verifyContract?a=${addr}`;
      pushHistory({ address: addr, name: f.name, symbol: f.symbol, chainId });
      $("m_addr").value = addr;
      toast("部署成功", "ok");
    } catch (e) {
      toast(errText(e), "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "部署合约";
    }
  }

  /* ---------------- 管理 ---------------- */

  async function loadContract() {
    const addr = $("m_addr").value.trim();
    if (!ethers.isAddress(addr)) return toast("合约地址不合法", "err");
    try {
      contract = new ethers.Contract(addr, ARTIFACT.abi, signer || provider);
      const usdtAddr = await contract.USDT();
      usdt = new ethers.Contract(usdtAddr, ["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "function decimals() view returns (uint8)"], signer || provider);
      $("manageBody").classList.remove("hidden");
      await refresh();
      toast("合约已载入", "ok");
    } catch (e) {
      toast(errText(e), "err");
    }
  }

  async function refresh() {
    if (!contract) return;
    const c = contract;
    const addr = await c.getAddress();
    const [name, symbol, owner, pair, launched, mintCount, usdtRaised, launchedAt, mintDeadline,
      maxMints, maxPerWallet, price, perMint, taxBps, lpLock, agentId, agentIdRequired, taxWallet, totalSupply] =
      await Promise.all([
        c.name(), c.symbol(), c.owner(), c.pair(), c.launched(), c.mintCount(), c.usdtRaised(),
        c.launchedAt(), c.mintDeadline(), c.MAX_MINTS(), c.MAX_PER_WALLET(), c.PRICE(), c.PER_MINT(),
        c.TAX_BPS(), c.LP_LOCK(), c.AGENT_ID(), c.agentIdRequired(), c.taxWallet(), c.totalSupply(),
      ]);
    const maxSupply = await c.MAX_SUPPLY().catch(() => 0n); // 旧版合约没有此接口
    const usdtDec = await usdt.decimals();
    const lpToken = new ethers.Contract(pair, ["function balanceOf(address) view returns (uint256)"], provider || signer);
    const lpBal = await lpToken.balanceOf(addr);

    state = { addr, name, symbol, owner, pair, launched, mintCount, usdtRaised, launchedAt, mintDeadline,
      maxMints, maxSupply, maxPerWallet, price, perMint, taxBps, lpLock, agentId, agentIdRequired, taxWallet, usdtDec, lpBal };

    const raised = Number(ethers.formatUnits(usdtRaised, usdtDec));
    const priceU = Number(ethers.formatUnits(price, usdtDec));
    const perMintT = Number(ethers.formatUnits(perMint, 18));
    const isOwner = account && owner.toLowerCase() === account.toLowerCase();
    const lpUnlockAt = Number(launchedAt) + Number(lpLock);

    $("m_stats").innerHTML = `
      ${stat("代币", `${name} (${symbol})`)}
      ${stat("合约地址", link(addr, shortAddr(addr)))}
      ${stat("owner", link(owner, shortAddr(owner)), isOwner ? "ok" : "warn")}
      ${stat("当前身份", isOwner ? "合约 owner" : "普通地址")}
      ${stat("交易对", link(pair, shortAddr(pair)))}
      ${stat("状态", launched ? "已开盘" : "未开盘", launched ? "ok" : "warn")}
      ${stat("mint 进度", `${mintCount} / ${maxMints} 份`)}
      ${stat("当前总供应", `${fmtNum(Number(ethers.formatUnits(totalSupply, 18)))} ${symbol}`)}
      ${stat("有效总量（硬顶）", maxSupply > 0n ? `${fmtNum(Number(ethers.formatUnits(maxSupply, 18)))} ${symbol}` : "未设置（旧版）", maxSupply > 0n ? "warn" : "")}
      ${stat("已募 USDT", `${fmtNum(raised)} / ${fmtNum(Number(maxMints) * priceU)}`)}
      ${stat("每份", `${fmtNum(perMintT)} 枚 @ ${fmtNum(priceU)} USDT`)}
      ${stat("税率", `${Number(taxBps) / 100} %`)}
      ${stat("税收钱包", link(taxWallet, shortAddr(taxWallet)))}
      ${stat("NFT 门槛", agentIdRequired ? "开启" : "关闭", agentIdRequired ? "warn" : "")}
      ${stat("mint 截止", Number(mintDeadline) ? countdown(mintDeadline) : "-")}
      ${stat("开盘时间", Number(launchedAt) ? new Date(Number(launchedAt) * 1000).toLocaleString() : "-")}
      ${stat("LP 解锁", launched ? countdown(lpUnlockAt) : "-", launched && Date.now() / 1000 > lpUnlockAt ? "ok" : "warn")}
      ${stat("合约持有 LP", ethers.formatUnits(lpBal, 18).slice(0, 10))}
    `;

    if (account) {
      const [minted, allowance, bal] = await Promise.all([
        c.mintedBy(account),
        usdt.allowance(account, addr),
        usdt.balanceOf(account),
      ]);
      $("m_userStats").innerHTML = `
        ${stat("我已 mint", `${minted} / ${maxPerWallet} 份`)}
        ${stat("USDT 余额", fmtNum(ethers.formatUnits(bal, usdtDec)))}
        ${stat("已授权额度", fmtNum(ethers.formatUnits(allowance, usdtDec)))}
        ${stat("我的持币", fmtNum(ethers.formatUnits(await c.balanceOf(account), 18)) + " " + symbol)}
      `;
    }

    const gateSel = $("m_gateSelect");
    gateSel.value = agentIdRequired ? "true" : "false";
    gateSel.disabled = !isOwner;
    $("launchBtn").disabled = !isOwner || launched;
    $("withdrawLpBtn").disabled = !isOwner || !launched || Date.now() / 1000 < lpUnlockAt;
    $("forceLaunchBtn").disabled = launched || Date.now() / 1000 <= Number(mintDeadline);
  }

  function stat(label, value, cls) {
    return `<div class="stat ${cls || ""}"><i>${label}</i><b>${value}</b></div>`;
  }

  async function send(fn, label) {
    if (!contract) return toast("请先载入合约", "err");
    const btns = document.querySelectorAll("button");
    btns.forEach((b) => (b.disabled = true));
    try {
      const tx = await fn();
      toast(label + " 已提交，等待确认…");
      await tx.wait();
      toast(label + " 成功 " + txLink(tx.hash, ""), "ok");
      await refresh();
    } catch (e) {
      toast(errText(e), "err");
    } finally {
      btns.forEach((b) => (b.disabled = false));
      await refresh().catch(() => {});
    }
  }

  /* ---------------- 事件绑定 ---------------- */

  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      $("tab-deploy").classList.toggle("hidden", t.dataset.tab !== "deploy");
      $("tab-manage").classList.toggle("hidden", t.dataset.tab !== "manage");
    })
  );

  $("connectBtn").addEventListener("click", connect);
  $("chainSelect").addEventListener("change", () => account && ensureChain().catch((e) => toast(errText(e), "err")));
  $("autoSupplyBtn").addEventListener("click", () => {
    const maxSupply = Number($("f_maxSupply").value);
    const maxMints = Number($("f_maxMints").value);
    if (!(maxSupply > 0 && maxMints > 0)) return toast("请先填有效总量与份数上限", "err");
    const per = maxSupply / 2 / maxMints;
    $("f_perMint").value = Number.isInteger(per) ? per : per.toFixed(6);
    renderPreview();
    toast(`每份已设为 ${$("f_perMint").value} 枚（硬顶 ${maxSupply} ÷ 2 ÷ ${maxMints} 份）`, "ok");
  });
  ["f_name","f_symbol","f_price","f_perMint","f_maxMints","f_maxSupply","f_maxPerWallet","f_taxPct","f_lpLockDays","f_mintWindowDays","f_taxWallet","f_usdtDecimals","f_agentId"].forEach((id) => {
    const el = $(id);
    el && el.addEventListener("input", renderPreview);
  });
  $("deployBtn").addEventListener("click", deploy);
  $("copyArgsBtn").addEventListener("click", async () => {
    const v = $("r_args").value;
    if (!v) return toast("还没有部署记录", "err");
    try {
      await navigator.clipboard.writeText(v);
      toast("构造参数已复制", "ok");
    } catch {
      $("r_args").select();
      toast("请按 Ctrl+C 复制", "err");
    }
  });
  $("toManageBtn").addEventListener("click", () => {
    document.querySelector('.tab[data-tab="manage"]').click();
    if ($("m_addr").value) loadContract();
  });

  $("loadBtn").addEventListener("click", loadContract);
  $("refreshBtn").addEventListener("click", () => refresh().catch((e) => toast(errText(e), "err")));
  $("m_history").addEventListener("change", (e) => {
    if (e.target.value) { $("m_addr").value = e.target.value; loadContract(); }
  });

  $("approveBtn").addEventListener("click", () => {
    const amt = $("m_approveAmt").value;
    send(async () => {
      const dec = state.usdtDec || 18;
      return usdt.approve(await contract.getAddress(), ethers.parseUnits(String(amt || "0"), dec));
    }, "授权");
  });
  $("mintBtn").addEventListener("click", () => send(() => contract.mint(), "mint"));

  $("launchBtn").addEventListener("click", () => send(() => contract.launch(), "开盘"));
  $("forceLaunchBtn").addEventListener("click", () => send(() => contract.forceLaunch(), "强制开盘"));
  $("setTaxBtn").addEventListener("click", () => {
    const v = $("m_newTaxWallet").value.trim();
    if (!ethers.isAddress(v)) return toast("地址不合法", "err");
    send(() => contract.setTaxWallet(v), "税收钱包更新");
  });
  $("exemptOnBtn").addEventListener("click", () => {
    const v = $("m_exemptAddr").value.trim();
    if (!ethers.isAddress(v)) return toast("地址不合法", "err");
    send(() => contract.setFeeExempt(v, true), "加入免税");
  });
  $("exemptOffBtn").addEventListener("click", () => {
    const v = $("m_exemptAddr").value.trim();
    if (!ethers.isAddress(v)) return toast("地址不合法", "err");
    send(() => contract.setFeeExempt(v, false), "取消免税");
  });
  $("setGateBtn").addEventListener("click", () =>
    send(() => contract.setAgentIdRequired($("m_gateSelect").value === "true"), "门槛开关")
  );
  $("sweepBtn").addEventListener("click", () => send(() => contract.sweepExcessUsdt(account), "取回误转 USDT"));
  $("withdrawLpBtn").addEventListener("click", () => send(() => contract.withdrawLp(account), "取出 LP"));

  /* ---------------- 初始化 ---------------- */
  renderPreview();
  renderHistory();
  if (window.ethereum) {
    window.ethereum.request({ method: "eth_accounts" }).then((accs) => {
      if (accs && accs[0]) connect();
    }).catch(() => {});
  }
})();
