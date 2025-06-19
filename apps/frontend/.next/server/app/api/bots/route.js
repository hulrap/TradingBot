(()=>{var e={};e.id=312,e.ids=[312],e.modules={846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},3033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},4870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},8009:()=>{},8281:()=>{},8886:(e,t,r)=>{"use strict";r.r(t),r.d(t,{patchFetch:()=>I,routeModule:()=>p,serverHooks:()=>R,workAsyncStorage:()=>_,workUnitAsyncStorage:()=>l});var a={};r.r(a),r.d(a,{DELETE:()=>c,GET:()=>E,POST:()=>u,PUT:()=>T});var s=r(7785),i=r(966),n=r(5037),o=r(2456),d=r(8923);async function E(e){try{let{searchParams:t}=new URL(e.url),r=t.get("userId");if(!r)return o.NextResponse.json({success:!1,error:"User ID is required"},{status:400});let a=d.uR.findByUserId(r);return o.NextResponse.json({success:!0,data:a})}catch(e){return console.error("Error fetching bot configurations:",e),o.NextResponse.json({success:!1,error:"Failed to fetch bot configurations"},{status:500})}}async function u(e){try{let t,r=await e.json();if(!r.userId||!r.walletId)return o.NextResponse.json({success:!1,error:"User ID and Wallet ID are required"},{status:400});let a=`bot_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;if(r.tokenPair)t={id:a,userId:r.userId,walletId:r.walletId,chain:r.chain||"ETH",tokenPair:r.tokenPair,minProfitThreshold:r.minProfitThreshold||.1,tradeSize:r.tradeSize||.1,isActive:!1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};else if(r.targetWalletAddress)t={id:a,userId:r.userId,walletId:r.walletId,chain:r.chain||"ETH",targetWalletAddress:r.targetWalletAddress,tradeSize:r.tradeSize||{type:"FIXED",value:.1},isActive:!1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};else{if(!r.targetDex)return o.NextResponse.json({success:!1,error:"Invalid bot configuration type"},{status:400});t={id:a,userId:r.userId,walletId:r.walletId,chain:r.chain||"ETH",targetDex:r.targetDex,minVictimTradeSize:r.minVictimTradeSize||1,maxGasPrice:r.maxGasPrice||100,isActive:!1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}return d.uR.create(t),o.NextResponse.json({success:!0,data:{id:a}})}catch(e){return console.error("Error creating bot configuration:",e),o.NextResponse.json({success:!1,error:"Failed to create bot configuration"},{status:500})}}async function T(e){try{let{id:t,isActive:r}=await e.json();if(!t||"boolean"!=typeof r)return o.NextResponse.json({success:!1,error:"Bot configuration ID and active status are required"},{status:400});return d.uR.updateStatus(t,r),o.NextResponse.json({success:!0,data:!0})}catch(e){return console.error("Error updating bot configuration:",e),o.NextResponse.json({success:!1,error:"Failed to update bot configuration"},{status:500})}}async function c(e){try{let{searchParams:t}=new URL(e.url),r=t.get("botConfigId");if(!r)return o.NextResponse.json({success:!1,error:"Bot configuration ID is required"},{status:400});return d.uR.updateStatus(r,!1),d.uR.delete(r),o.NextResponse.json({success:!0,data:!0})}catch(e){return console.error("Error deleting bot configuration:",e),o.NextResponse.json({success:!1,error:"Failed to delete bot configuration"},{status:500})}}let p=new s.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/bots/route",pathname:"/api/bots",filename:"route",bundlePath:"app/api/bots/route"},resolvedPagePath:"C:\\Users\\User1\\Downloads\\TradingBot\\apps\\frontend\\src\\app\\api\\bots\\route.ts",nextConfigOutput:"",userland:a}),{workAsyncStorage:_,workUnitAsyncStorage:l,serverHooks:R}=p;function I(){return(0,n.patchFetch)({workAsyncStorage:_,workUnitAsyncStorage:l})}},8923:(e,t,r)=>{"use strict";r.d(t,{uR:()=>n,vC:()=>o,qp:()=>i});let a=require("better-sqlite3"),s=new(r.n(a)())(process.env.DATABASE_PATH||"trading_bot.db"),i={create:e=>s.prepare(`
      INSERT INTO wallets (id, user_id, address, encrypted_private_key, chain, name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(e.id,e.userId,e.address,e.encryptedPrivateKey,e.chain,e.name),findByUserId:e=>s.prepare("SELECT * FROM wallets WHERE user_id = ?").all(e).map(e=>({id:e.id,userId:e.user_id,address:e.address,encryptedPrivateKey:e.encrypted_private_key,chain:e.chain,name:e.name,createdAt:e.created_at})),findById:e=>{let t=s.prepare("SELECT * FROM wallets WHERE id = ?").get(e);return t?{id:t.id,userId:t.user_id,address:t.address,encryptedPrivateKey:t.encrypted_private_key,chain:t.chain,name:t.name,createdAt:t.created_at}:null},delete:e=>s.prepare("DELETE FROM wallets WHERE id = ?").run(e)},n={create:e=>s.prepare(`
      INSERT INTO bot_configs (id, user_id, wallet_id, bot_type, config_data, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(e.id,e.userId,e.walletId,"ARBITRAGE",JSON.stringify(e),e.isActive),findByUserId:e=>s.prepare("SELECT * FROM bot_configs WHERE user_id = ?").all(e).map(e=>JSON.parse(e.config_data)),findById:e=>{let t=s.prepare("SELECT * FROM bot_configs WHERE id = ?").get(e);return t?JSON.parse(t.config_data):null},updateStatus:(e,t)=>s.prepare("UPDATE bot_configs SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(t,e),delete:e=>s.prepare("DELETE FROM bot_configs WHERE id = ?").run(e)},o={create:e=>s.prepare(`
      INSERT INTO trades (id, bot_config_id, bot_type, tx_hash, chain, token_in, token_out, amount_in, amount_out, gas_used, gas_price, profit, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.id,e.botConfigId,e.botType,e.txHash,e.chain,e.tokenIn,e.tokenOut,e.amountIn,e.amountOut,e.gasUsed,e.gasPrice,e.profit,e.status),findByBotConfigId:e=>s.prepare("SELECT * FROM trades WHERE bot_config_id = ? ORDER BY created_at DESC").all(e).map(e=>({id:e.id,botConfigId:e.bot_config_id,botType:e.bot_type,txHash:e.tx_hash,chain:e.chain,tokenIn:e.token_in,tokenOut:e.token_out,amountIn:e.amount_in,amountOut:e.amount_out,gasUsed:e.gas_used,gasPrice:e.gas_price,profit:e.profit,status:e.status,createdAt:e.created_at,completedAt:e.completed_at})),findByUserId:e=>s.prepare(`
      SELECT t.* FROM trades t
      JOIN bot_configs bc ON t.bot_config_id = bc.id
      WHERE bc.user_id = ?
      ORDER BY t.created_at DESC
    `).all(e).map(e=>({id:e.id,botConfigId:e.bot_config_id,botType:e.bot_type,txHash:e.tx_hash,chain:e.chain,tokenIn:e.token_in,tokenOut:e.token_out,amountIn:e.amount_in,amountOut:e.amount_out,gasUsed:e.gas_used,gasPrice:e.gas_price,profit:e.profit,status:e.status,createdAt:e.created_at,completedAt:e.completed_at})),updateStatus:(e,t,r)=>s.prepare("UPDATE trades SET status = ?, completed_at = ? WHERE id = ?").run(t,r,e)};s.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),s.exec(`
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
  `),s.exec(`
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
  `),s.exec(`
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
  `),s.exec(`
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
  `),console.log("Database initialized successfully")},9294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[683,658],()=>r(8886));module.exports=a})();