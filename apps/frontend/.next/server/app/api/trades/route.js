(()=>{var e={};e.id=395,e.ids=[395],e.modules={846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},3033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},4870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},8009:()=>{},8281:()=>{},8863:(e,t,r)=>{"use strict";r.r(t),r.d(t,{patchFetch:()=>R,routeModule:()=>c,serverHooks:()=>N,workAsyncStorage:()=>p,workUnitAsyncStorage:()=>_});var a={};r.r(a),r.d(a,{GET:()=>E,POST:()=>T,PUT:()=>u});var s=r(7785),i=r(966),n=r(5037),d=r(2456),o=r(8923);async function E(e){try{let t,{searchParams:r}=new URL(e.url),a=r.get("userId"),s=r.get("botConfigId");if(!a&&!s)return d.NextResponse.json({success:!1,error:"User ID or Bot Config ID is required"},{status:400});return t=s?o.vC.findByBotConfigId(s):a?o.vC.findByUserId(a):[],d.NextResponse.json({success:!0,data:t})}catch(e){return console.error("Error fetching trades:",e),d.NextResponse.json({success:!1,error:"Failed to fetch trades"},{status:500})}}async function T(e){try{let t=await e.json(),r=`trade_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,a={id:r,...t};return o.vC.create(a),d.NextResponse.json({success:!0,data:{id:r}})}catch(e){return console.error("Error creating trade:",e),d.NextResponse.json({success:!1,error:"Failed to record trade"},{status:500})}}async function u(e){try{let{id:t,status:r,completedAt:a}=await e.json();if(!t||!r)return d.NextResponse.json({success:!1,error:"Trade ID and status are required"},{status:400});return o.vC.updateStatus(t,r,a),d.NextResponse.json({success:!0,data:!0})}catch(e){return console.error("Error updating trade:",e),d.NextResponse.json({success:!1,error:"Failed to update trade"},{status:500})}}let c=new s.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/trades/route",pathname:"/api/trades",filename:"route",bundlePath:"app/api/trades/route"},resolvedPagePath:"C:\\Users\\User1\\Downloads\\TradingBot\\apps\\frontend\\src\\app\\api\\trades\\route.ts",nextConfigOutput:"",userland:a}),{workAsyncStorage:p,workUnitAsyncStorage:_,serverHooks:N}=c;function R(){return(0,n.patchFetch)({workAsyncStorage:p,workUnitAsyncStorage:_})}},8923:(e,t,r)=>{"use strict";r.d(t,{uR:()=>n,vC:()=>d,qp:()=>i});let a=require("better-sqlite3"),s=new(r.n(a)())(process.env.DATABASE_PATH||"trading_bot.db"),i={create:e=>s.prepare(`
      INSERT INTO wallets (id, user_id, address, encrypted_private_key, chain, name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(e.id,e.userId,e.address,e.encryptedPrivateKey,e.chain,e.name),findByUserId:e=>s.prepare("SELECT * FROM wallets WHERE user_id = ?").all(e).map(e=>({id:e.id,userId:e.user_id,address:e.address,encryptedPrivateKey:e.encrypted_private_key,chain:e.chain,name:e.name,createdAt:e.created_at})),findById:e=>{let t=s.prepare("SELECT * FROM wallets WHERE id = ?").get(e);return t?{id:t.id,userId:t.user_id,address:t.address,encryptedPrivateKey:t.encrypted_private_key,chain:t.chain,name:t.name,createdAt:t.created_at}:null},delete:e=>s.prepare("DELETE FROM wallets WHERE id = ?").run(e)},n={create:e=>s.prepare(`
      INSERT INTO bot_configs (id, user_id, wallet_id, bot_type, config_data, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(e.id,e.userId,e.walletId,"ARBITRAGE",JSON.stringify(e),e.isActive),findByUserId:e=>s.prepare("SELECT * FROM bot_configs WHERE user_id = ?").all(e).map(e=>JSON.parse(e.config_data)),findById:e=>{let t=s.prepare("SELECT * FROM bot_configs WHERE id = ?").get(e);return t?JSON.parse(t.config_data):null},updateStatus:(e,t)=>s.prepare("UPDATE bot_configs SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(t,e),delete:e=>s.prepare("DELETE FROM bot_configs WHERE id = ?").run(e)},d={create:e=>s.prepare(`
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
  `),console.log("Database initialized successfully")},9294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[683,658],()=>r(8863));module.exports=a})();