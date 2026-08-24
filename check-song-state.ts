import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://uqmqkntnpuecswcrtulz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbXFrbnRucHVlY3N3Y3J0dWx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMwNjIzMCwiZXhwIjoyMTAyODgyMjMwfQ.yGcVG1RTqqRoj-dMH0k0lhLGHtbniPxdHAGo3v0wT10');
const { data } = await supabase.from('songs').select('id, request_id, title, lyrics, mureka_status, audio_url, duration, mureka_task_id').eq('id', 'ef2905f5-5066-4c77-a800-26573dc0157f').single();
console.log(JSON.stringify(data, null, 2));