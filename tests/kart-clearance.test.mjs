import test from 'node:test'
import assert from 'node:assert/strict'
import {sceneryClearOfTrack} from '../src/engine/art/trackClearance.ts'

test('scenery clusters and their hills stay outside the entire road',()=>{
  const samples=[{x:0,z:0},{x:1,z:0}]
  assert.equal(sceneryClearOfTrack(0,10,1,false,14,samples),false)
  assert.equal(sceneryClearOfTrack(0,18,2,true,14,samples),false)
  assert.equal(sceneryClearOfTrack(0,25,2,true,14,samples),true)
})
