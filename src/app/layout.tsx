import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'
import { Providers } from './providers'
import './globals.css'

// Inter — self-hosted через next/font/google (експорт Inter існує; cyrillic обовʼязковий).
const inter = Inter({ subsets: ['latin', 'cyrillic'], weight: ['400', '600', '700'], variable: '--font-inter' })

// Material Symbols Outlined — self-hosted .woff2 через next/font/local.
// Причина: `Material_Symbols_Outlined` НЕ експортується з next/font/google у next@16.2.10
// (TS2305: has no exported member). Файл завантажено з fonts.gstatic.com у src/app/fonts/.
const symbols = localFont({
  src: './fonts/material-symbols-outlined.woff2',
  weight: '400',
  display: 'block',
  variable: '--font-symbols',
})

export const metadata: Metadata = {
  title: 'Облік Комерційної Оренди',
  description: 'Облік комерційної оренди й комунальних послуг',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${inter.variable} ${symbols.variable}`}>
      <body className="bg-surface text-on-surface min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
