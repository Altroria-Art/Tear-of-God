// Interface language coverage, interpolation safety, and API error presentation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import i18next from 'i18next';
import XLSX from 'xlsx';
import { apiErrorMessage, localizeApiResult } from '../../src/lib/apiMessages.js';
import { buildCommunityExcelWorkbook, calculateCommunityTasteAnalysis } from '../../src/lib/communityExcelExport.js';

const resources = Object.fromEntries(['en', 'th'].map(lang => [lang, { translation: JSON.parse(fs.readFileSync(`src/locales/${lang}.json`, 'utf8')) }]));
const flatten = (doc, prefix = '') => Object.fromEntries(Object.entries(doc).flatMap(([key, value]) => typeof value === 'string' ? [[prefix + key, value]] : Object.entries(flatten(value, `${prefix}${key}.`))));
const en = flatten(resources.en.translation), th = flatten(resources.th.translation);
assert.deepEqual(Object.keys(en).sort(), Object.keys(th).sort(), 'Both languages cover the same interface keys');
const tokens = value => [...value.matchAll(/{{\s*([^}]+?)\s*}}/g)].map(match => match[1]).sort();
for (const key of Object.keys(en)) {
  assert(en[key].trim() && th[key].trim(), `${key} is not blank`);
  assert.deepEqual(tokens(en[key]), tokens(th[key]), `${key}: matching interpolation parameters`);
  const tags = value => [...value.matchAll(/<\/?(\w+)[^>]*>/g)].map(match => match[0]).sort();
  assert.deepEqual(tags(en[key]), tags(th[key]), `${key}: matching rich-text markup`);
}
const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(path.join(directory, item.name)) : [path.join(directory, item.name)]);
const missing=[];
for (const file of files('src').filter(file => /\.(jsx?|tsx?)$/.test(file))) {
  const source=fs.readFileSync(file,'utf8');
  for (const match of source.matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) {
    if (match[1].includes('.') && !match[1].endsWith('.') && !(match[1] in en)) missing.push(`${file}: ${match[1]}`);
  }
}
assert.deepEqual(missing, [], 'Every static translation reference exists');
const i18n=i18next.createInstance();
await i18n.init({resources, lng:'en', fallbackLng:false, interpolation:{escapeValue:false}});
for (const lang of ['en','th']) {
  await i18n.changeLanguage(lang);
  const t=i18n.t.bind(i18n);
  const errors=[
    ['Invalid email or password',401,'loginInvalid'],
    ['อีเมลหรือรหัสผ่านไม่ถูกต้อง',401,'loginInvalid'],
    ['Invalid, expired or used code',400,'resetInvalid'],
    ['SQLITE_ERROR: secret internal statement',500,'unavailable'],
    [{private:'diagnostic'},429,'tooFast'],
    ['Badge is not unlocked',403,'badgeLocked'],
    ['Unrecognised internal diagnostic',403,'forbidden'],
  ];
  for (const [error,status,key] of errors) assert.equal(apiErrorMessage(error,{status,t}),t(`apiMessages.${key}`));
  const input={success:false,error:'SQLITE_ERROR: private',code:'INTERNAL_ERROR',retry_after:12,data:{id:'untouched'}};
  const result=localizeApiResult(input,500,t);
  assert.equal(result.error,t('apiMessages.unavailable'));
  assert.deepEqual({...result,error:input.error},input,'Only the displayed error changes');
  assert.equal(input.error,'SQLITE_ERROR: private','Input is not mutated');
  assert.equal(localizeApiResult({success:true,data:[]},200,t).success,true);
  assert.equal(apiErrorMessage('title must be 1–120 characters',{status:400,t}),t('apiMessages.fieldLength',{field:t('apiFields.title'),range:'1–120'}));
  const template={id:'copy-topic',title:'ชื่อของผู้ใช้ / User title',tiers:[{label:'ระดับของฉัน',color:'#ff7777'}]};
  const participants=[{user_id:'one',username:'ชื่อจริง / Real name',ranking_items:[{item_id:'x',item_name:'รายการจริง',tier:'ระดับของฉัน'}]}];
  const {wb,ws}=buildCommunityExcelWorkbook(XLSX,{template,participants,displayTiers:template.tiers,t});
  assert.equal(ws.A1.v,t('excel.topic'));
  assert.equal(ws.B1.v,template.title,'User topic titles remain unchanged');
  assert.equal(ws.A7.v,t('excel.tier'));
  assert.equal(ws.A8.v,'ระดับของฉัน','Custom tier names remain unchanged');
  assert(wb.Sheets[t('excel.analysisSheet')]);
  const analysis=calculateCommunityTasteAnalysis({template,participants,t});
  assert.equal(analysis.participants[0].username,participants[0].username);
  assert.equal(analysis.participants[0].standoutSummary,t('excel.close'));
}
console.log(`UI copy passed: ${Object.keys(en).length} keys in both languages, source references, parameters, localized errors, and Excel content.`);
