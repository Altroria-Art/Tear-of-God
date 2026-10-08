import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../../src/pages/Login.jsx',import.meta.url),'utf8');
const start=source.indexOf('  const changeMode =');
const end=source.indexOf('\n  };',start)+6;
let state={email:'ux-test@example.invalid',username:'Independent display name'};
const scope=vm.createContext({isLoading:false,...Object.fromEntries(['Password','ConfirmPassword','ShowPassword','ShowConfirmPassword','AuthError','IsRegister'].map(key=>['set'+key,value=>{state[key]=value;}]))});
vm.runInContext(source.slice(start,end)+'\nthis.change=changeMode;',scope);
for(const register of [true,false,true,false,true]) {
  Object.assign(state,{Password:'dummy',ConfirmPassword:'dummy',ShowPassword:true,ShowConfirmPassword:true,AuthError:'old mode error'});
  scope.change(register);
  assert.equal(state.Password,'');assert.equal(state.ConfirmPassword,'');
  assert.equal(state.ShowPassword,false);assert.equal(state.ShowConfirmPassword,false);
  assert.equal(state.AuthError,'');assert.equal(state.IsRegister,register);
  assert.equal(state.email,'ux-test@example.invalid');assert.equal(state.username,'Independent display name');
}
assert.match(source,/onSwitchMode=\{changeMode\}/);
assert.match(source,/onClick=\{\(\) => changeMode\(!isRegister\)\}/);
scope.isLoading=true;state.Password='pending';scope.change(false);assert.equal(state.Password,'pending');
const en=JSON.parse(await readFile(new URL('../../src/locales/en.json',import.meta.url),'utf8'));
const th=JSON.parse(await readFile(new URL('../../src/locales/th.json',import.meta.url),'utf8'));
assert.match(en.auth.loginSubtitle,/publish.*account.*conversations/);
assert.match(en.guestGate.description,/Start ranking without an account/);
assert.match(th.auth.loginSubtitle,/เผยแพร่.*บัญชี.*พูดคุย/);
assert.match(th.guestGate.description,/เริ่มจัดอันดับได้โดยไม่ต้องมีบัญชี/);
console.log('Auth mode reset: both directions, repeated transitions, email/username independence and pending request guard pass.');
