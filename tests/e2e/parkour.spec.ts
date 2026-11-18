import {test,expect} from '@playwright/test'

test('Parkour: guest can resume in the second world via legacy link and navigate unlocked stages', async({page})=>{
  test.setTimeout(120_000)
  await page.setViewportSize({width:540,height:320})
  await page.addInitScript(()=>{const k='freshblox.hub.parkourPractice';if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify({stage:101,best:101}))})
  await page.goto('/?room=OBBY-1');const location=page.getByLabel('Parkour',{exact:true})
  await expect(location).toContainText('Świat 2/5 · Kanion Wiatraków');await expect(location).toContainText('Prąd wstępujący')
  await expect(page.getByRole('button',{name:'Next Stage'})).toBeDisabled()
  await page.getByRole('button',{name:'Previous Stage'}).click();await expect(location).toContainText('Świat 1/5')
  await page.getByRole('button',{name:'Next Stage'}).click();await expect(location).toContainText('Świat 2/5')
  await page.reload();await expect(location).toContainText('Prąd wstępujący')
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('freshblox.hub.parkourPractice')!))).toEqual({best:101,stage:101,completions:0})
})

test('Parkour: stage 500 has its own course, no medal or finish dialog on spawn',async({page})=>{
  test.setTimeout(120_000)
  await page.setViewportSize({width:575,height:360});await page.addInitScript(()=>localStorage.setItem('freshblox.hub.parkourPractice',JSON.stringify({stage:500,best:500,completions:0})))
  await page.goto('/?world=obby&room=OBBY-1');const location=page.getByLabel('Parkour',{exact:true})
  await expect(location).toContainText('Korona pięciu światów');await expect(page.getByText('UKOŃCZYŁEŚ PARKOUR!')).toHaveCount(0)
  await page.getByRole('button',{name:'Previous Stage'}).click();await expect(location).toContainText('Ostatnia konstelacja');await page.getByRole('button',{name:'Next Stage'}).click();await expect(location).toContainText('Korona pięciu światów')
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('freshblox.hub.parkourPractice')!).completions)).toBe(0)
})
