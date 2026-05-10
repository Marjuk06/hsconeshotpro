import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';

// Force Next.js to always fetch fresh data and never cache this layout
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: any): Promise<Metadata> {
  // 1. Safely await params (Required in newer Next.js versions to read the URL)
  const resolvedParams = await params;
  const classId = resolvedParams.id;

  // 2. Fetch data from Supabase
  const { data: video, error } = await supabase.from('videos').select('*').eq('id', classId).single();

  // 3. Fallback: If it actually fails, show a generic title instead of "Not Found"
  if (!video || error) {
    return {
      title: "HSC OneShot Pro Class",
      description: "Watch this class on HSC OneShot Pro."
    };
  }

  // 4. Extract High-Res YouTube Thumbnail
  const videoId = video.url.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
  const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : "https://hsconeshotpro.codenestui.top/icon.png";

  return {
    title: `${video.title} | HSC OneShot Pro`,
    description: `Watch ${video.title} - ${video.subject} ${video.paper}. Free One-shot classes.`,
    openGraph: {
      title: video.title,
      description: `${video.subject} • ${video.chapter}`,
      url: `https://hsconeshotpro.codenestui.top/study/${classId}`,
      images: [{ url: thumbnailUrl, width: 1280, height: 720 }],
      type: "video.other",
    }
  };
}

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}