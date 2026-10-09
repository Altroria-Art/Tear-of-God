import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('../../src/pages/Login.jsx',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const start=source.indexOf('  const changeMode =');
const end=source.indexOf('\n  };',start)+6;
let state={loginEmail:'login@example.invalid',registerEmail:'signup@example.invalid',username:'Independent display name'};
const scope=vm.createContext({isLoading:false,...Object.fromEntries(['LoginEmail','RegisterEmail','Username','LoginPassword','RegisterPassword','ConfirmPassword','ShowPassword','ShowConfirmPassword','AuthError','IsRegister'].map(key=>['set'+key,value=>{state[key[0].toLowerCase()+key.slice(1)]=value;state[key]=value;}]))});
vm.runInContext(source.slice(start,end)+'\nthis.change=changeMode;',scope);
for(const register of [true,false,true,false,true]) {
  Object.assign(state,{loginEmail:'login@example.invalid',registerEmail:'signup@example.invalid',username:'Independent display name',LoginPassword:'dummy-login',RegisterPassword:'dummy-signup',ConfirmPassword:'dummy',ShowPassword:true,ShowConfirmPassword:true,AuthError:'old mode error'});
  scope.change(register);
  assert.equal(state.LoginPassword,'');assert.equal(state.RegisterPassword,'');assert.equal(state.ConfirmPassword,'');
  assert.equal(state.ShowPassword,false);assert.equal(state.ShowConfirmPassword,false);
  assert.equal(state.AuthError,'');assert.equal(state.IsRegister,register);
  assert.equal(state.loginEmail,'');assert.equal(state.registerEmail,'');assert.equal(state.username,'');
}
assert.match(source,/onSwitchMode=\{changeMode\}/);
assert.match(source,/onClick=\{\(\) => changeMode\(!isRegister\)\}/);
scope.isLoading=true;state.LoginPassword='pending';scope.change(false);assert.equal(state.LoginPassword,'pending');
const en=JSON.parse(await readFile(new URL('../../src/locales/en.json',import.meta.url),'utf8'));
const th=JSON.parse(await readFile(new URL('../../src/locales/th.json',import.meta.url),'utf8'));
assert.match(en.auth.loginSubtitle,/Log in.*post rankings.*comments/);
assert.match(en.guestGate.description,/rank now.*Log in.*post/);
assert.match(th.auth.loginSubtitle,/ล็อกอิน.*โพสต์.*คอมเมนต์/);
assert.match(th.guestGate.description,/จัดอันดับได้เลย.*ล็อกอิน.*โพสต์/);
console.log('Auth mode reset: both directions, repeated transitions, all fields cleared and pending request guard pass.');
