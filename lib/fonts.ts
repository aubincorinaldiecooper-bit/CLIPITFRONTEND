import { Archivo, Inter } from 'next/font/google';

// Archivo is variable; loading the wdth axis lets us push it wide.
export const archivo = Archivo({ subsets: ['latin'], display: 'swap', variable: '--font-archivo', axes: ['wdth'] });
export const inter   = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
