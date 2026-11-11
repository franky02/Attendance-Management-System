// Stations Dad can work at. Each has its own staff, muster, absentees and night duty;
// national holidays are shared. To add a station, add one line here.
export interface Station { code: string; name: string }

export const STATIONS: Station[] = [
  { code: 'MASS', name: 'MGR Chennai Central Suburban' },
  { code: 'BBQ', name: 'Basin Bridge Junction' },
  { code: 'KOK', name: 'Korukkupet' },
  { code: 'TNP', name: 'Tondiarpet' },
  { code: 'VOC', name: 'V.O.C. Nagar' },
  { code: 'TVT', name: 'Tiruvottiyur' },
  { code: 'WCN', name: 'Wimco Nagar' },
  { code: 'KAVM', name: 'Kathivakkam' },
  { code: 'ENR', name: 'Ennore' },
  { code: 'AIPP', name: 'Attipattu Pudu Nagar' },
  { code: 'AIP', name: 'Attippattu' },
  { code: 'NPKM', name: 'Nandiyampakkam' },
  { code: 'MJR', name: 'Minjur' },
  { code: 'APB', name: 'Anuppambattu' },
  { code: 'PON', name: 'Ponneri' },
  { code: 'KVP', name: 'Kavaraippettai' },
  { code: 'GPD', name: 'Gummidipundi' },
  { code: 'ELR', name: 'Elavur' },
  { code: 'AAB', name: 'Arambakkam' },
]

export const DEFAULT_STATION = 'ENR' // all data entered before stations existed belongs to Ennore
const KEY = 'ennore-muster-station'

export function stationByCode(code: string): Station {
  return STATIONS.find((s) => s.code === code) ?? STATIONS.find((s) => s.code === DEFAULT_STATION)!
}

function readStation(): string {
  try {
    const c = localStorage.getItem(KEY)
    if (c && STATIONS.some((s) => s.code === c)) return c
  } catch { /* ignore */ }
  return DEFAULT_STATION
}

/** The station this page is working on. Fixed for the page's lifetime: switching reloads the app. */
export const STATION: Station = stationByCode(readStation())

export function rememberStation(code: string) {
  try { localStorage.setItem(KEY, code) } catch { /* ignore */ }
}

/** Switch station: remember it and reload, so every screen and cache starts fresh for that station. */
export function switchStation(code: string) {
  rememberStation(code)
  window.location.reload()
}

/** "ENNORE", "MGR CHENNAI CENTRAL SUBURBAN": as printed on the paper forms. */
export function printName(s: Station = STATION): string {
  return s.name.toUpperCase()
}

/** For file names: "ENNORE", "MGR-CHENNAI-CENTRAL-SUBURBAN". */
export function fileTag(s: Station = STATION): string {
  return printName(s).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
}
