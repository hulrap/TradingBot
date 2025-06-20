"use strict";exports.id=113,exports.ids=[113],exports.modules={5113:(e,r,t)=>{t.d(r,{PZ:()=>c});var n=t(4538),E=t(5890);let a=new(t.n(E)())(process.env.DATABASE_PATH||"trading_bot.db"),o={create:e=>a.prepare(`
      INSERT INTO users (id, email, password_hash)
      VALUES (?, ?, ?)
    `).run(e.id,e.email,e.passwordHash),findByEmail:e=>{let r=a.prepare("SELECT * FROM users WHERE email = ?").get(e);return r?{id:r.id,email:r.email,passwordHash:r.password_hash,encryptedPrivateKey:"",createdAt:r.created_at,updatedAt:r.updated_at}:null},findById:e=>{let r=a.prepare("SELECT * FROM users WHERE id = ?").get(e);return r?{id:r.id,email:r.email,passwordHash:r.password_hash,encryptedPrivateKey:"",createdAt:r.created_at,updatedAt:r.updated_at}:null},updateLastLogin:e=>a.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").run(e),updatePassword:(e,r)=>a.prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(r,e)};a.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    )
  `),a.exec(`
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
  `),a.exec(`
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
  `),a.exec(`
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
  `),a.exec(`
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
  `),console.log("Database initialized successfully");var i=t(1376);let s=i.z.object({JWT_SECRET:i.z.string().min(32,"JWT_SECRET must be at least 32 characters for security").regex(/^[A-Za-z0-9+/=_-]+$/,"JWT_SECRET contains invalid characters"),DATABASE_PATH:i.z.string().min(1,"DATABASE_PATH is required").optional().default("trading_bot.db"),SUPABASE_URL:i.z.string().url("SUPABASE_URL must be a valid URL").optional(),SUPABASE_SERVICE_ROLE_KEY:i.z.string().min(100,"SUPABASE_SERVICE_ROLE_KEY appears to be invalid (too short)").optional(),SUPABASE_ANON_KEY:i.z.string().min(100,"SUPABASE_ANON_KEY appears to be invalid (too short)").optional(),NODE_ENV:i.z.enum(["development","production","test"]).default("development"),NEXTAUTH_SECRET:i.z.string().min(32,"NEXTAUTH_SECRET must be at least 32 characters").optional(),REDIS_URL:i.z.string().url("REDIS_URL must be a valid URL").optional(),ENCRYPTION_KEY:i.z.string().min(32,"ENCRYPTION_KEY must be at least 32 characters for security").optional()}),T=s.extend({JWT_SECRET:i.z.string().min(64,"JWT_SECRET must be at least 64 characters in production").regex(/^[A-Za-z0-9+/=_-]{64,}$/,"JWT_SECRET must be properly generated for production"),NODE_ENV:i.z.literal("production"),SUPABASE_URL:i.z.string().url("SUPABASE_URL is required in production"),SUPABASE_SERVICE_ROLE_KEY:i.z.string().min(100,"SUPABASE_SERVICE_ROLE_KEY is required in production")});s.extend({JWT_SECRET:i.z.string().min(32,"JWT_SECRET must be at least 32 characters even in development").default(()=>(console.warn("⚠️  Using generated JWT_SECRET for development. Set JWT_SECRET environment variable."),function(e=64){let r="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=-_",n="";try{let E=t(6113).randomBytes(e);for(let t=0;t<e;t++)n+=r[E[t]%r.length];return n}catch(t){console.warn("⚠️  Using Math.random for secret generation. Install crypto module for production.");for(let t=0;t<e;t++)n+=r[Math.floor(Math.random()*r.length)];return n}}(64)))});let d=null;async function c(e){try{let r,t=e.cookies.get("auth_token")?.value;if(!t){let r=e.headers.get("authorization");r&&r.startsWith("Bearer ")&&(t=r.substring(7))}if(!t)return{success:!1,error:"No authentication token provided"};try{r=function(){if(d)return d;let e=function(){let e=process.env,r=[],t={JWT_SECRET:e.JWT_SECRET,DATABASE_PATH:e.DATABASE_PATH,SUPABASE_URL:e.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:e.SUPABASE_SERVICE_ROLE_KEY,SUPABASE_ANON_KEY:e.SUPABASE_ANON_KEY,NODE_ENV:"production",NEXTAUTH_SECRET:e.NEXTAUTH_SECRET,REDIS_URL:e.REDIS_URL,ENCRYPTION_KEY:e.ENCRYPTION_KEY};try{let e;if(e=T.parse(t),"default-secret-for-development"===e.JWT_SECRET)throw Error("CRITICAL: Default JWT secret detected in production");if(e.SUPABASE_URL&&!e.SUPABASE_SERVICE_ROLE_KEY)throw Error("SUPABASE_SERVICE_ROLE_KEY is required when SUPABASE_URL is set");return e.JWT_SECRET.length<64&&r.push("JWT_SECRET is shorter than recommended 64 characters"),console.log(`✅ Environment validation successful for ${e.NODE_ENV} mode`),r.length>0&&r.forEach(e=>console.warn(`⚠️  ${e}`)),{success:!0,environment:e,warnings:r.length>0?r:void 0}}catch(e){if(e instanceof i.z.ZodError){let r=e.errors.map(e=>`${e.path.join(".")}: ${e.message}`);return console.error("❌ Environment validation failed:",r),{success:!1,errors:r}}return console.error("❌ Environment validation failed:",e instanceof Error?e.message:"Unknown error"),{success:!1,errors:[e instanceof Error?e.message:"Unknown validation error"]}}}();if(!e.success){let r="Environment validation failed. Check your environment variables.";throw console.error(r,e.errors),Error(r)}return d=e.environment}()}catch(e){return console.error("Environment validation failed during JWT verification:",e),{success:!1,error:"Authentication service configuration error"}}r.JWT_SECRET;let E=await (0,n.PZ)(t);if(!E.sub)return{success:!1,error:"Invalid token: missing user identifier"};if(!o.findById(E.sub))return{success:!1,error:"User account not found or deactivated"};if(E.exp&&E.exp<Math.floor(Date.now()/1e3))return{success:!1,error:"Token has expired"};let a={sub:E.sub,...E.email&&{email:E.email},...E.iat&&{iat:E.iat},...E.exp&&{exp:E.exp}};return{success:!0,payload:a}}catch(r){if(console.warn("JWT verification failed:",{error:r instanceof Error?r.message:"Unknown error",timestamp:new Date().toISOString(),ip:e.headers.get("x-forwarded-for")||e.headers.get("x-real-ip")||"unknown"}),r instanceof Error){if("TokenExpiredError"===r.name)return{success:!1,error:"Token has expired"};if("JsonWebTokenError"===r.name)return{success:!1,error:"Invalid token"};if("NotBeforeError"===r.name)return{success:!1,error:"Token not yet valid"}}return{success:!1,error:"Authentication failed"}}}},4538:(e,r,t)=>{t.d(r,{Gv:()=>l,HI:()=>d,PZ:()=>A,R1:()=>S,XX:()=>_,c_:()=>u,pe:()=>c});var n=t(6113),E=t(8383),a=t(2541),o=t(4627);let i="aes-256-cbc",s=null;function T(){if(s)return s;let e=process.env.MASTER_ENCRYPTION_KEY;if(!e)throw Error("FATAL: MASTER_ENCRYPTION_KEY environment variable is not set.");return s=new Uint8Array((0,n.scryptSync)(e,"salt",32))}function d(e){let r=T(),t=new Uint8Array((0,n.randomBytes)(16)),E=(0,n.createCipheriv)(i,r,t),a=E.update(e,"utf8","hex");return a+=E.final("hex"),`${Buffer.from(t).toString("hex")}:${a}`}function c(e){let r=T(),[t,E]=e.split(":");if(!t||!E)throw Error("Invalid hash format for decryption.");let a=new Uint8Array(Buffer.from(t,"hex")),o=(0,n.createDecipheriv)(i,r,a);return o.update(E,"hex","utf8")+o.final("utf8")}async function u(e){if(!e||e.length<8)throw Error("Password must be at least 8 characters long");return E.vp(e,12)}async function l(e,r){return!!e&&!!r&&E.qu(e,r)}async function _(e,r="24h"){let t=R();return await new a.N(e).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime(r).sign(t)}async function A(e){let r=R();try{let{payload:t}=await o._(e,r);return t}catch(e){throw Error("Invalid or expired token")}}function R(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET environment variable is not set");if(e.length<32)throw Error("JWT_SECRET must be at least 32 characters long");return new TextEncoder().encode(e)}function S(e=32){return(0,n.randomBytes)(e).toString("hex")}}};