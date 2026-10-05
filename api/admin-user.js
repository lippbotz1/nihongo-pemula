const admin = require('firebase-admin');

function getAdminApp(){
  if(admin.apps.length) return admin.app();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g,'\n');
  if(!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) throw new Error('Missing Firebase Admin environment variables');
  return admin.initializeApp({credential: admin.credential.cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey}),databaseURL:process.env.FIREBASE_DATABASE_URL});
}
function json(res,status,data){res.status(status).json(data)}
async function body(req){ if(req.body && typeof req.body==='object') return req.body; return {}; }
function admins(){return String(process.env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)}
async function verify(req){
  const h=req.headers.authorization||''; if(!h.startsWith('Bearer ')) throw Object.assign(new Error('Unauthorized'),{status:401});
  const decoded=await admin.auth().verifyIdToken(h.slice(7));
  if(!admins().includes(String(decoded.email||'').toLowerCase())) throw Object.assign(new Error('Forbidden'),{status:403});
  return decoded;
}
const ALLOWED_DURATIONS = new Set([30,90,365,9999]);
const DAY = 86400000;
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return json(res,405,{error:'method_not_allowed'});
  try{
    getAdminApp(); const adminUser=await verify(req); const b=await body(req); const action=String(b.action||'').trim();
    if(action==='list'){
      const out=[]; let token;
      do {
        const page=await admin.auth().listUsers(1000,token);
        page.users.forEach(u=>out.push({uid:u.uid,email:u.email||'',disabled:!!u.disabled,createdAt:u.metadata.creationTime||null,lastSignInAt:u.metadata.lastSignInTime||null}));
        token=page.pageToken;
      } while(token);
      const snap=await admin.database().ref('licenses').once('value'); const licenses=snap.val()||{};
      return json(res,200,{users:out.map(u=>({...u,license:licenses[u.uid]||null}))});
    }
    if(action==='create'){
      const email=String(b.email||'').trim().toLowerCase(), password=String(b.password||'');
      if(!/^\S+@\S+\.\S+$/.test(email)) return json(res,400,{error:'invalid_email'});
      if(password.length<8) return json(res,400,{error:'password_too_short'});
      const duration=Number(b.duration); if(!ALLOWED_DURATIONS.has(duration)) return json(res,400,{error:'invalid_duration'});
      const now=Date.now(); const expiresAt=duration===9999?null:now+duration*DAY;
      let user;
      try{ user=await admin.auth().createUser({email,password,disabled:false}); }
      catch(e){ if(e.code==='auth/email-already-exists')return json(res,409,{error:'email_exists'}); throw e; }
      await admin.database().ref('licenses/'+user.uid).set({active:true,duration,expiresAt,createdAt:now,updatedAt:now,email});
      return json(res,200,{ok:true,user:{uid:user.uid,email},license:{active:true,duration,expiresAt,createdAt:now,updatedAt:now}});
    }
    if(action==='update'){
      const uid=String(b.uid||''); if(!uid)return json(res,400,{error:'missing_uid'});
      if(uid===adminUser.uid && b.disabled===true) return json(res,400,{error:'cannot_disable_current_admin'});
      const ref=admin.database().ref('licenses/'+uid); const snap=await ref.once('value'); const old=snap.val()||{};
      const duration=b.duration===undefined?Number(old.duration||30):Number(b.duration);
      if(!ALLOWED_DURATIONS.has(duration)) return json(res,400,{error:'invalid_duration'});
      const active=b.active===undefined?old.active!==false:!!b.active; const now=Date.now();
      let expiresAt=old.expiresAt?Number(old.expiresAt):null;
      if(b.renew===true){
        if(duration===9999) expiresAt=null;
        else { const base=expiresAt && expiresAt>now ? expiresAt : now; expiresAt=base+duration*DAY; }
      } else if(b.duration!==undefined){
        expiresAt=duration===9999?null:now+duration*DAY;
      }
      const patch={...old,active,duration,expiresAt,updatedAt:now,email:old.email||null};
      await ref.set(patch);
      if(b.disabled!==undefined) await admin.auth().updateUser(uid,{disabled:!!b.disabled});
      return json(res,200,{ok:true,license:patch});
    }
    if(action==='delete'){
      const uid=String(b.uid||''); if(!uid)return json(res,400,{error:'missing_uid'});
      if(uid===adminUser.uid) return json(res,400,{error:'cannot_delete_current_admin'});
      await admin.database().ref('licenses/'+uid).remove(); await admin.auth().deleteUser(uid);
      return json(res,200,{ok:true});
    }
    if(action==='resetPassword'){
      const uid=String(b.uid||''); const password=String(b.password||'');
      if(!uid||password.length<8)return json(res,400,{error:'invalid_input'});
      await admin.auth().updateUser(uid,{password}); return json(res,200,{ok:true});
    }
    return json(res,400,{error:'unknown_action'});
  }catch(e){ console.error(e); return json(res,e.status||500,{error:e.message||'server_error'}); }
};
  
