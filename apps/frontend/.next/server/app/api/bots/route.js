"use strict";(()=>{var e={};e.id=176,e.ids=[176],e.modules={517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},9122:(e,t,a)=>{a.r(t),a.d(t,{headerHooks:()=>g,originalPathname:()=>N,patchFetch:()=>R,requestAsyncStorage:()=>l,routeModule:()=>_,serverHooks:()=>I,staticGenerationAsyncStorage:()=>p,staticGenerationBailout:()=>A});var r={};a.r(r),a.d(r,{DELETE:()=>c,GET:()=>E,POST:()=>T,PUT:()=>u});var i=a(5649),s=a(8584),o=a(5144),n=a(7180),d=a(4936);async function E(e){try{let{searchParams:t}=new URL(e.url),a=t.get("userId");if(!a)return n.Z.json({success:!1,error:"User ID is required"},{status:400});let r=d.mS.findByUserId(a);return n.Z.json({success:!0,data:r})}catch(e){return console.error("Error fetching bot configurations:",e),n.Z.json({success:!1,error:"Failed to fetch bot configurations"},{status:500})}}async function T(e){try{let t;let a=await e.json();if(!a.userId||!a.walletId)return n.Z.json({success:!1,error:"User ID and Wallet ID are required"},{status:400});let r=`bot_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;if(a.tokenPair)t={id:r,userId:a.userId,walletId:a.walletId,chain:a.chain||"ETH",tokenPair:a.tokenPair,minProfitThreshold:a.minProfitThreshold||.1,tradeSize:a.tradeSize||.1,isActive:!1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};else if(a.targetWalletAddress)t={id:r,userId:a.userId,walletId:a.walletId,chain:a.chain||"ETH",targetWalletAddress:a.targetWalletAddress,tradeSize:a.tradeSize||{type:"FIXED",value:.1},isActive:!1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};else{if(!a.targetDex)return n.Z.json({success:!1,error:"Invalid bot configuration type"},{status:400});t={id:r,userId:a.userId,walletId:a.walletId,chain:a.chain||"ETH",targetDex:a.targetDex,minVictimTradeSize:a.minVictimTradeSize||1,maxGasPrice:a.maxGasPrice||100,isActive:!1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}return d.mS.create(t),n.Z.json({success:!0,data:{id:r}})}catch(e){return console.error("Error creating bot configuration:",e),n.Z.json({success:!1,error:"Failed to create bot configuration"},{status:500})}}async function u(e){try{let{id:t,isActive:a}=await e.json();if(!t||"boolean"!=typeof a)return n.Z.json({success:!1,error:"Bot configuration ID and active status are required"},{status:400});return d.mS.updateStatus(t,a),n.Z.json({success:!0,data:!0})}catch(e){return console.error("Error updating bot configuration:",e),n.Z.json({success:!1,error:"Failed to update bot configuration"},{status:500})}}async function c(e){try{let{searchParams:t}=new URL(e.url),a=t.get("botConfigId");if(!a)return n.Z.json({success:!1,error:"Bot configuration ID is required"},{status:400});return d.mS.updateStatus(a,!1),d.mS.delete(a),n.Z.json({success:!0,data:!0})}catch(e){return console.error("Error deleting bot configuration:",e),n.Z.json({success:!1,error:"Failed to delete bot configuration"},{status:500})}}let _=new i.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/bots/route",pathname:"/api/bots",filename:"route",bundlePath:"app/api/bots/route"},resolvedPagePath:"C:\\Users\\User1\\Downloads\\TradingBot\\apps\\frontend\\src\\app\\api\\bots\\route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:l,staticGenerationAsyncStorage:p,serverHooks:I,headerHooks:g,staticGenerationBailout:A}=_,N="/api/bots/route";function R(){return(0,o.patchFetch)({serverHooks:I,staticGenerationAsyncStorage:p})}},4936:(e,t,a)=>{a.d(t,{mS:()=>o,cC:()=>n,Gk:()=>s});let r=require("better-sqlite3"),i=new(a.n(r)())(process.env.DATABASE_PATH||"trading_bot.db"),s={create:e=>i.prepare(`
      INSERT INTO wallets (id, user_id, address, encrypted_private_key, chain, name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(e.id,e.userId,e.address,e.encryptedPrivateKey,e.chain,e.name),findByUserId:e=>i.prepare("SELECT * FROM wallets WHERE user_id = ?").all(e).map(e=>({id:e.id,userId:e.user_id,address:e.address,encryptedPrivateKey:e.encrypted_private_key,chain:e.chain,name:e.name,createdAt:e.created_at})),findById:e=>{let t=i.prepare("SELECT * FROM wallets WHERE id = ?").get(e);return t?{id:t.id,userId:t.user_id,address:t.address,encryptedPrivateKey:t.encrypted_private_key,chain:t.chain,name:t.name,createdAt:t.created_at}:null},delete:e=>i.prepare("DELETE FROM wallets WHERE id = ?").run(e)},o={create:e=>i.prepare(`
      INSERT INTO bot_configs (id, user_id, wallet_id, bot_type, config_data, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(e.id,e.userId,e.walletId,"ARBITRAGE",JSON.stringify(e),e.isActive),findByUserId:e=>i.prepare("SELECT * FROM bot_configs WHERE user_id = ?").all(e).map(e=>JSON.parse(e.config_data)),findById:e=>{let t=i.prepare("SELECT * FROM bot_configs WHERE id = ?").get(e);return t?JSON.parse(t.config_data):null},updateStatus:(e,t)=>i.prepare("UPDATE bot_configs SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(t,e),delete:e=>i.prepare("DELETE FROM bot_configs WHERE id = ?").run(e)},n={create:e=>i.prepare(`
      INSERT INTO trades (id, bot_config_id, bot_type, tx_hash, chain, token_in, token_out, amount_in, amount_out, gas_used, gas_price, profit, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.id,e.botConfigId,e.botType,e.txHash,e.chain,e.tokenIn,e.tokenOut,e.amountIn,e.amountOut,e.gasUsed,e.gasPrice,e.profit,e.status),findByBotConfigId:e=>i.prepare("SELECT * FROM trades WHERE bot_config_id = ? ORDER BY created_at DESC").all(e).map(e=>({id:e.id,botConfigId:e.bot_config_id,botType:e.bot_type,txHash:e.tx_hash,chain:e.chain,tokenIn:e.token_in,tokenOut:e.token_out,amountIn:e.amount_in,amountOut:e.amount_out,gasUsed:e.gas_used,gasPrice:e.gas_price,profit:e.profit,status:e.status,createdAt:e.created_at,completedAt:e.completed_at})),findByUserId:e=>i.prepare(`
      SELECT t.* FROM trades t
      JOIN bot_configs bc ON t.bot_config_id = bc.id
      WHERE bc.user_id = ?
      ORDER BY t.created_at DESC
    `).all(e).map(e=>({id:e.id,botConfigId:e.bot_config_id,botType:e.bot_type,txHash:e.tx_hash,chain:e.chain,tokenIn:e.token_in,tokenOut:e.token_out,amountIn:e.amount_in,amountOut:e.amount_out,gasUsed:e.gas_used,gasPrice:e.gas_price,profit:e.profit,status:e.status,createdAt:e.created_at,completedAt:e.completed_at})),updateStatus:(e,t,a)=>i.prepare("UPDATE trades SET status = ?, completed_at = ? WHERE id = ?").run(t,a,e)};i.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),i.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      address TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      chain TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `),i.exec(`
    CREATE TABLE IF NOT EXISTS bot_configs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      wallet_id TEXT NOT NULL,
      bot_type TEXT NOT NULL,
      config_data TEXT NOT NULL,
      is_active BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (wallet_id) REFERENCES wallets (id)
    )
  `),i.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      bot_config_id TEXT NOT NULL,
      bot_type TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      chain TEXT NOT NULL,
      token_in TEXT NOT NULL,
      token_out TEXT NOT NULL,
      amount_in TEXT NOT NULL,
      amount_out TEXT NOT NULL,
      gas_used TEXT NOT NULL,
      gas_price TEXT NOT NULL,
      profit TEXT,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (bot_config_id) REFERENCES bot_configs (id)
    )
  `),i.exec(`
    CREATE TABLE IF NOT EXISTS bot_status (
      bot_config_id TEXT PRIMARY KEY,
      is_running BOOLEAN DEFAULT FALSE,
      last_activity DATETIME,
      total_trades INTEGER DEFAULT 0,
      total_profit TEXT DEFAULT '0',
      errors TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_config_id) REFERENCES bot_configs (id)
    )
  `),console.log("Database initialized successfully")}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[807,309],()=>a(9122));module.exports=r})();