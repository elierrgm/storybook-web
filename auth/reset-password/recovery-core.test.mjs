import test from 'node:test';
import assert from 'node:assert/strict';
import {readRecoveryLink,readRecoverySession,validNewPassword,createRecoverySession} from './recovery-core.mjs';
const config={supabaseURL:'https://fixture.invalid',publishableKey:'public-fixture',resetPasswordURL:'https://fixture.invalid/reset/'};
const reply=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
test('recovery-only links reject missing, wrong and duplicate parameters',()=>{
 assert.equal(readRecoveryLink('https://site/reset?token_hash=fixture&type=recovery'),'fixture');
 assert.equal(readRecoveryLink('https://site/reset#token_hash=fixture&type=recovery'),'fixture');
 assert.equal(readRecoveryLink('https://site/reset?token_hash=a&type=recovery#token_hash=b&type=recovery'),null);
 for(const url of ['https://site/reset','https://site/reset?token_hash=a&type=signup','https://site/reset?token_hash=a&token_hash=b&type=recovery','https://site/reset?token_hash=a&type=recovery&error=expired']) assert.equal(readRecoveryLink(url),null);
});
test('15 Unicode code points; spaces allowed',()=>{
 assert.equal(validNewPassword('a'.repeat(14)),false);assert.equal(validNewPassword('a'.repeat(15)),true);
 assert.equal(validNewPassword('a long passphrase'),true);assert.equal(validNewPassword('🌕'.repeat(15)),true);
});
test('save requires verified unexpired recovery; weak password never sent',async()=>{
 let calls=[];let now=0;
 const session=createRecoverySession(config,async(url,options)=>{calls.push({url,options});return reply({access_token:'fixture-token',expires_in:30});},()=>now);
 await assert.rejects(session.save('a long passphrase'),/expired/);assert.equal(calls.length,0);
 const ready=createRecoverySession(config,async(url,options)=>{calls.push({url,options});return reply({access_token:'fixture-token',expires_in:30});},()=>now);
 await ready.verify('fixture-hash');await assert.rejects(ready.save('short'),/weak/);assert.equal(calls.length,1);
 now=31000;await assert.rejects(ready.save('a long passphrase'),/expired/);assert.equal(calls.length,1);
});
test('verified save clears credentials, prevents replay and revokes only local recovery session',async()=>{
 let calls=[];const session=createRecoverySession(config,async(url,options)=>{calls.push({url,options});return reply({access_token:'fixture-token',expires_in:30});});
 await session.verify('fixture-hash');await session.save('a long passphrase');
 assert.equal(calls.length,3);assert.match(calls[2].url,/logout\?scope=local$/);
 assert.equal(calls[1].options.headers.Authorization,'Bearer fixture-token');
 await assert.rejects(session.save('another long password'),/expired/);assert.equal(calls.length,3);
});
test('invalid/reused links cannot update password',async()=>{
 let calls=0;const session=createRecoverySession(config,async()=>{calls++;return reply({},403);});
 await assert.rejects(session.verify('used'),/invalid/);await assert.rejects(session.save('a long passphrase'),/expired/);assert.equal(calls,1);
});
test('recover uses neutral success and preserves rate limit',async()=>{
 const session=createRecoverySession(config,async()=>reply({}));await session.requestLink('parent@example.com');
 const limited=createRecoverySession(config,async()=>reply({},429));await assert.rejects(limited.requestLink('parent@example.com'),/rate-limit/);
});

test('default email recovery accepts only well-formed recovery fragments',()=>{
 const fragment='access_token=fixture&token_type=bearer&expires_in=3600&type=recovery';
 assert.equal(readRecoverySession('https://site/reset#'+fragment).token,'fixture');
 for(const url of ['https://site/reset?'+fragment,'https://site/reset#'+fragment.replace('recovery','signup'),'https://site/reset#'+fragment+'&access_token=other','https://site/reset#'+fragment.replace('3600','NaN')]) assert.equal(readRecoverySession(url),null);
});
test('default recovery validates server session before permitting a password update',async()=>{
 const calls=[];
 const session=createRecoverySession(config,async(url,options)=>{calls.push({url,options});return reply({id:'fixture-user'});},()=>0);
 await session.verifySession({token:'fixture-session',expires:30000});
 assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.body,undefined);
 await session.save('a long passphrase');assert.equal(calls[1].options.method,'PUT');
 const invalid=createRecoverySession(config,async()=>reply({},401),()=>0);
 await assert.rejects(invalid.verifySession({token:'bad',expires:30000}),/invalid/);
 await assert.rejects(invalid.save('a long passphrase'),/expired/);
});
