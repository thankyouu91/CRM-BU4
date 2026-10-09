import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { appFont } from "@/lib/font";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "WorkHub · Quản lý công việc", template: "%s · WorkHub" },
  description: "Dashboard quản lý dự án, công việc, báo cáo và trình chiếu trực tuyến.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#090b14" },
  ],
};

// Apply the saved/system theme before paint to avoid a light→dark flash.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={appFont.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
