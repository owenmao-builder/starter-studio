import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Starter Studio · AI 产品搭建工作台',description:'拖入 PRD，从需求到上线。每次开发都有代码书签，每一步由你确认。',icons:{icon:`${process.env.NEXT_PUBLIC_BASE_PATH||''}/favicon.svg`}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
