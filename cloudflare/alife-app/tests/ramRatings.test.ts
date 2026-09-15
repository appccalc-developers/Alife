import { test } from 'node:test'
import assert from 'node:assert/strict'
import { previewRisk, worstRamLevel } from '../src/utils/ramRatings.ts'
import { emptyActivityPlan, validStoredActivityPlan } from '../src/types/eventActivityPlan.ts'
import type { RamRisk, RamPolicyData } from '../src/types/ramGovernance.ts'
const text={en:'Test',zh:'测试'}
const risk:RamRisk={id:'r',activityId:'a',categoryCode:'activity',hazard:text,consequence:text,controlMeasures:text,additionalAction:text,personResponsible:'Leader',likelihood:2,impact:3,residualLikelihood:1,residualImpact:2}
test('arithmetic is immediate; colours follow the selected policy rather than thresholds',()=>{
 const policy={matrix:[{likelihood:2,impact:3,level:'Green'},{likelihood:1,impact:2,level:'Red'}]} as RamPolicyData
 const result=previewRisk(risk,policy)
 assert.equal(result.riskScore,6);assert.equal(result.initialLevel,'Green');assert.equal(result.residualScore,2);assert.equal(result.residualLevel,'Red')
 assert.equal(worstRamLevel([result,result]),'Red')
})
test('missing ratings and policy cannot imply green, including obsolete saved scores',()=>{
 assert.equal(previewRisk(risk).residualLevel,'Incomplete')
 const unrated=previewRisk({...risk,likelihood:null,residualImpact:null,residualScore:1,residualLevel:'Green'})
 assert.equal(unrated.riskScore,null);assert.equal(unrated.residualScore,null);assert.equal(unrated.residualLevel,'Incomplete')
 assert.equal(worstRamLevel([]),'Incomplete')
})
test('creation activity drafts retain bilingual fields and stable associations; reject malformed recovery',()=>{
 const plan={...emptyActivityPlan(),activities:[{id:'stable',type:'water',name:text,conditions:{en:'',zh:'救生衣'},occurrenceId:null}]}
 assert.ok(validStoredActivityPlan(JSON.parse(JSON.stringify(plan))))
 assert.equal(validStoredActivityPlan({...plan,activities:[...plan.activities,...plan.activities]}),false)
 assert.equal(validStoredActivityPlan({...plan,activities:[{...plan.activities[0],conditions:'lost bilingual shape'}]}),false)
})
