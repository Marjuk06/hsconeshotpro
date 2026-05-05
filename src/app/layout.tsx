import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AmbientGlow from "@/components/AmbientGlow";
import StudyBuddy from "@/components/StudyBuddy";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "HSC OneShot Pro",
  description: "FreeOne-shot classes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen font-sans antialiased overflow-x-hidden flex flex-col selection:bg-indigo-500/30 transition-all duration-700">
        <AmbientGlow />
        <Navbar />
        <main className="container mx-auto px-6 py-4 flex-grow relative">
          {children}
        </main>
        <StudyBuddy />
        
        {/* Premium Glassmorphism Toasts */}
        <Toaster 
          position="bottom-right"
          toastOptions={{
            className: '!bg-black/60 !backdrop-blur-xl !text-white !border !border-white/10 !shadow-2xl !rounded-2xl',
            success: { iconTheme: { primary: '#10b981', secondary: 'black' } },
            error: { iconTheme: { primary: '#ef4444', secondary: 'black' } },
          }} 
        />
      </body>
    </html>
  );
}