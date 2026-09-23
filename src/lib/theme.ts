export type Theme='light'|'dark'|'system'
export function applyTheme(theme:Theme) {
  document.documentElement.dataset.theme=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme
  try{localStorage.setItem('lifeos-theme',theme)}catch{/* Preferência não bloqueia o uso. */}
}
export function initialTheme() {try{const theme=localStorage.getItem('lifeos-theme');applyTheme(theme==='dark'||theme==='system'?theme:'light')}catch{applyTheme('light')}}
