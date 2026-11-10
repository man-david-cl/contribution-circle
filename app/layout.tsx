import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Contribution Circle | Together, on schedule',description:'A clear and secure way to manage your rotating contribution group.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
