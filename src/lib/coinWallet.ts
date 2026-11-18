import { supabase } from './supabase'
export type Wallet = { balance: number; owned: string[] }
const empty = (): Wallet => ({ balance: 0, owned: [] })
export async function readWallet(userId: string): Promise<Wallet> {
  if (!supabase) return empty()
  const { data } = await supabase
    .from('fb_coin_wallets')
    .select('balance,owned')
    .eq('user_id', userId)
    .maybeSingle<Wallet>()
  return data ?? empty()
}
export async function buyWithCoins(item: string): Promise<Wallet | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('fb_coin_buy', { p_item: item })
  return !error && typeof data?.balance === 'number' && Array.isArray(data.owned) ? (data as Wallet) : null
}
export async function startKartRun(): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('fb_kart_begin')
  return !error && typeof data === 'string' ? data : null
}
export type LapReceipt = { balance: number; reward: number; new_credit: boolean }
export async function settleKartLap(run: string, lap: number): Promise<LapReceipt | null> {
  if (!supabase) return null
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error, status } = await supabase.rpc('fb_kart_lap', { p_run: run, p_lap: lap })
    if (!error && typeof data?.balance === 'number') return data as LapReceipt
    if (status > 0 && status < 500) break
  }
  return null
}
