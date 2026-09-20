const{Client}=require('pg');
const c=new Client({connectionString:'postgresql://postgres.xdlssfxbndwuirwcofdx:Sued12345@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=no-verify',ssl:{rejectUnauthorized:false}});
c.connect().then(async()=>{
  var r=await c.query("SELECT id, request_id, status, proof_url, proof_filename, plan, amount, ai_verified, verification_result, user_email, created_at FROM payments WHERE created_at > now() - interval '24 hours' ORDER BY created_at DESC");
  console.log('Payments in last 24h:', r.rows.length);
  r.rows.forEach(x=>console.log(JSON.stringify(x,null,2)));
  
  // Also check song_requests updated recently
  var r2=await c.query("SELECT id, status, email, created_at FROM song_requests WHERE created_at > now() - interval '24 hours' ORDER BY created_at DESC");
  console.log('\nSong requests in last 24h:', r2.rows.length);
  r2.rows.forEach(x=>console.log(JSON.stringify(x)));
  
  await c.end();
}).catch(e=>{console.error(e.message);c.end()});
