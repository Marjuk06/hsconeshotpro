import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { data: video } = await supabase.from('videos').select('*').eq('id', params.id).single();

  if (!video) return { title: "Class Not Found" };

  const videoId = video.url.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
  const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : "https://hsconeshotpro.vercel.app/icon.png";

  return {
    title: `${video.title} | HSC OneShot Pro`,
    description: `Watch ${video.title} - ${video.subject} ${video.paper}. Free One-shot classes.`,
    openGraph: {
      title: video.title,
      description: `${video.subject} • ${video.chapter}`,
      url: `https://hsconeshotpro.vercel.app/study/${params.id}`,
      images: [{ url: thumbnailUrl, width: 1280, height: 720 }],
      type: "video.other",
    }
  };
}

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}